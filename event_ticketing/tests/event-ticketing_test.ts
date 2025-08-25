
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Test constants
const CONTRACT_NAME = "event-ticketing";
const MIN_TICKET_PRICE = 1000000; // 1 STX in microSTX
const FUTURE_BLOCK = 1000;
const MAX_REFUND_WINDOW = 1209600; // 14 days

Clarinet.test({
    name: "Successfully creates a new event with valid parameters",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Tech Conference 2025"),
                    types.utf8("Annual technology conference with industry leaders"),
                    types.utf8("Convention Center"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(100),
                    types.uint(MIN_TICKET_PRICE),
                    types.uint(1000),
                    types.utf8("Technology")
                ],
                organizer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), "true");
    },
});

Clarinet.test({
    name: "Fails to create event with ticket price below minimum",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Cheap Event"),
                    types.utf8("Event with low ticket price"),
                    types.utf8("Small Venue"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(50),
                    types.uint(MIN_TICKET_PRICE - 1), // Below minimum
                    types.uint(1000),
                    types.utf8("Budget")
                ],
                organizer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(5)); // ERR-INVALID-PRICE
    },
});

Clarinet.test({
    name: "Fails to create event with refund window exceeding maximum",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Long Refund Event"),
                    types.utf8("Event with excessive refund window"),
                    types.utf8("Venue"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(100),
                    types.uint(MIN_TICKET_PRICE),
                    types.uint(MAX_REFUND_WINDOW + 1), // Exceeds maximum
                    types.utf8("General")
                ],
                organizer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(5)); // ERR-INVALID-PRICE
    },
});

Clarinet.test({
    name: "Fails to create event with date in the past",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Past Event"),
                    types.utf8("Event scheduled in the past"),
                    types.utf8("Time Machine Venue"),
                    types.uint(1), // Past block
                    types.uint(100),
                    types.uint(MIN_TICKET_PRICE),
                    types.uint(1000),
                    types.utf8("History")
                ],
                organizer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(6)); // ERR-EVENT-EXPIRED
    },
});

Clarinet.test({
    name: "Successfully retrieves event information after creation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        
        // Create event
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Music Festival"),
                    types.utf8("Three-day music festival"),
                    types.utf8("Park Grounds"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(500),
                    types.uint(5000000), // 5 STX
                    types.uint(5000),
                    types.utf8("Music")
                ],
                organizer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), "true");
        
        // Retrieve event information
        let eventInfo = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-event",
            [types.uint(1)],
            organizer.address
        );
        
        const eventData = eventInfo.result.expectSome().expectTuple();
        assertEquals(eventData["name"], types.utf8("Music Festival"));
        assertEquals(eventData["organizer"], organizer.address);
        assertEquals(eventData["total-tickets"], types.uint(500));
        assertEquals(eventData["tickets-sold"], types.uint(0));
        assertEquals(eventData["ticket-price"], types.uint(5000000));
        assertEquals(eventData["is-active"], types.bool(true));
    },
});

Clarinet.test({
    name: "Creates multiple events and tracks organizer statistics",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        
        // Create first event
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Event 1"),
                    types.utf8("First event"),
                    types.utf8("Venue 1"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(100),
                    types.uint(MIN_TICKET_PRICE),
                    types.uint(1000),
                    types.utf8("Category 1")
                ],
                organizer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), "true");
        
        // Create second event
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Event 2"),
                    types.utf8("Second event"),
                    types.utf8("Venue 2"),
                    types.uint(FUTURE_BLOCK + 100),
                    types.uint(200),
                    types.uint(MIN_TICKET_PRICE * 2),
                    types.uint(2000),
                    types.utf8("Category 2")
                ],
                organizer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), "true");
        
        // Check organizer statistics
        let organizerRevenue = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-organizer-revenue",
            [organizer.address],
            organizer.address
        );
        
        const revenueData = organizerRevenue.result.expectSome().expectTuple();
        assertEquals(revenueData["events-organized"], types.uint(2));
        assertEquals(revenueData["total-revenue"], types.uint(0)); // No tickets sold yet
    },
});
