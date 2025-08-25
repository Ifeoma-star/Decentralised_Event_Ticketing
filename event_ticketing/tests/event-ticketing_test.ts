
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

// TICKET OPERATIONS TESTS

Clarinet.test({
    name: "Successfully purchases a ticket for an active event",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer = accounts.get("wallet_2")!;
        
        // Create event first
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Concert"),
                    types.utf8("Live music concert"),
                    types.utf8("Music Hall"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(100),
                    types.uint(2000000), // 2 STX
                    types.uint(1000),
                    types.utf8("Music")
                ],
                organizer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), "true");
        
        // Purchase ticket
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), "true");
        
        // Verify ticket creation
        let ticketInfo = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-ticket",
            [types.uint(1)],
            buyer.address
        );
        
        const ticketData = ticketInfo.result.expectSome().expectTuple();
        assertEquals(ticketData["event-id"], types.uint(1));
        assertEquals(ticketData["owner"], buyer.address);
        assertEquals(ticketData["purchase-price"], types.uint(2000000));
        assertEquals(ticketData["is-used"], types.bool(false));
        assertEquals(ticketData["is-refunded"], types.bool(false));
    },
});

Clarinet.test({
    name: "Fails to purchase ticket for non-existent event",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const buyer = accounts.get("wallet_2")!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(999)], // Non-existent event
                buyer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(2)); // ERR-EVENT-NOT-FOUND
    },
});

Clarinet.test({
    name: "Tracks user tickets and event ticket sales correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer1 = accounts.get("wallet_2")!;
        const buyer2 = accounts.get("wallet_3")!;
        
        // Create event
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Workshop"),
                    types.utf8("Educational workshop"),
                    types.utf8("Learning Center"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(50),
                    types.uint(1500000), // 1.5 STX
                    types.uint(500),
                    types.utf8("Education")
                ],
                organizer.address
            )
        ]);
        
        // Buy multiple tickets
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer1.address
            ),
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer2.address
            ),
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer1.address
            )
        ]);
        
        assertEquals(block.receipts.length, 3);
        block.receipts.forEach(receipt => {
            assertEquals(receipt.result.expectOk(), "true");
        });
        
        // Check event updated correctly
        let eventInfo = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-event",
            [types.uint(1)],
            organizer.address
        );
        
        const eventData = eventInfo.result.expectSome().expectTuple();
        assertEquals(eventData["tickets-sold"], types.uint(3));
        assertEquals(eventData["revenue"], types.uint(4500000)); // 3 * 1.5 STX
        
        // Check user tickets
        let userTickets = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-user-tickets",
            [buyer1.address],
            buyer1.address
        );
        
        const userTicketData = userTickets.result.expectSome().expectTuple();
        assertEquals(userTicketData["owned-tickets"], types.list([types.uint(1), types.uint(3)]));
    },
});

Clarinet.test({
    name: "Prevents ticket purchase when event is sold out",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer1 = accounts.get("wallet_2")!;
        const buyer2 = accounts.get("wallet_3")!;
        
        // Create small event
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Exclusive Event"),
                    types.utf8("Limited capacity event"),
                    types.utf8("Small Venue"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(1), // Only 1 ticket available
                    types.uint(MIN_TICKET_PRICE),
                    types.uint(1000),
                    types.utf8("Exclusive")
                ],
                organizer.address
            )
        ]);
        
        // Purchase the only ticket
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer1.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), "true");
        
        // Try to purchase another ticket (should fail)
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer2.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(3)); // ERR-SOLD-OUT
    },
});

Clarinet.test({
    name: "Successfully validates ticket by event organizer",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer = accounts.get("wallet_2")!;
        
        // Create event and purchase ticket
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Sports Event"),
                    types.utf8("Football match"),
                    types.utf8("Stadium"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(1000),
                    types.uint(3000000), // 3 STX
                    types.uint(2000),
                    types.utf8("Sports")
                ],
                organizer.address
            )
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        // Validate ticket
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "validate-ticket",
                [types.uint(1)],
                organizer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), "true");
        
        // Check ticket is marked as used
        let ticketInfo = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-ticket",
            [types.uint(1)],
            buyer.address
        );
        
        const ticketData = ticketInfo.result.expectSome().expectTuple();
        assertEquals(ticketData["is-used"], types.bool(true));
    },
});

Clarinet.test({
    name: "Prevents non-organizer from validating tickets",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer = accounts.get("wallet_2")!;
        const unauthorized = accounts.get("wallet_3")!;
        
        // Create event and purchase ticket
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Private Event"),
                    types.utf8("Invitation only"),
                    types.utf8("Secret Location"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(50),
                    types.uint(MIN_TICKET_PRICE),
                    types.uint(1000),
                    types.utf8("Private")
                ],
                organizer.address
            )
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        // Try to validate ticket with unauthorized user
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "validate-ticket",
                [types.uint(1)],
                unauthorized.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(1)); // ERR-NOT-AUTHORIZED
    },
});

Clarinet.test({
    name: "Successfully processes ticket refund within refund window",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer = accounts.get("wallet_2")!;
        
        // Create event and purchase ticket
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Refundable Event"),
                    types.utf8("Event with refund policy"),
                    types.utf8("Flexible Venue"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(100),
                    types.uint(2000000), // 2 STX
                    types.uint(1000), // 1000 blocks refund window
                    types.utf8("Flexible")
                ],
                organizer.address
            )
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        // Request refund immediately (within refund window)
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "refund-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), "true");
        
        // Check ticket is marked as refunded
        let ticketInfo = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-ticket",
            [types.uint(1)],
            buyer.address
        );
        
        const ticketData = ticketInfo.result.expectSome().expectTuple();
        assertEquals(ticketData["is-refunded"], types.bool(true));
        
        // Check event revenue is reduced
        let eventInfo = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-event",
            [types.uint(1)],
            organizer.address
        );
        
        const eventData = eventInfo.result.expectSome().expectTuple();
        assertEquals(eventData["revenue"], types.uint(0)); // Revenue reduced after refund
    },
});

Clarinet.test({
    name: "Prevents refund by non-ticket owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer = accounts.get("wallet_2")!;
        const unauthorized = accounts.get("wallet_3")!;
        
        // Create event and purchase ticket
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Protected Event"),
                    types.utf8("Secure ticket event"),
                    types.utf8("Safe Venue"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(100),
                    types.uint(MIN_TICKET_PRICE),
                    types.uint(1000),
                    types.utf8("Secure")
                ],
                organizer.address
            )
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        // Try to refund with unauthorized user
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "refund-ticket",
                [types.uint(1)],
                unauthorized.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(1)); // ERR-NOT-AUTHORIZED
    },
});

Clarinet.test({
    name: "Prevents validation of already used tickets",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer = accounts.get("wallet_2")!;
        
        // Create event, purchase and validate ticket
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("One-Time Event"),
                    types.utf8("Single use ticket event"),
                    types.utf8("Secure Venue"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(100),
                    types.uint(MIN_TICKET_PRICE),
                    types.uint(1000),
                    types.utf8("Secure")
                ],
                organizer.address
            )
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "validate-ticket",
                [types.uint(1)],
                organizer.address
            )
        ]);
        
        // Try to validate the same ticket again
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "validate-ticket",
                [types.uint(1)],
                organizer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(10)); // ERR-TICKET-USED
    },
});

// CONTRACT ADMINISTRATION AND EDGE CASES TESTS

Clarinet.test({
    name: "Contract owner successfully updates platform fee",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const contractOwner = accounts.get("deployer")!; // Contract owner is typically the deployer
        
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "update-platform-fee",
                [types.uint(10)], // Set to 10%
                contractOwner.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), "true");
        
        // Test platform fee calculation
        let feeCalculation = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "calculate-platform-fee",
            [types.uint(1000000)], // 1 STX
            contractOwner.address
        );
        
        assertEquals(feeCalculation.result, types.uint(100000)); // 10% of 1 STX
    },
});

Clarinet.test({
    name: "Prevents non-owner from updating platform fee",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const unauthorized = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "update-platform-fee",
                [types.uint(15)],
                unauthorized.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(1)); // ERR-NOT-AUTHORIZED
    },
});

Clarinet.test({
    name: "Prevents setting platform fee above 100%",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const contractOwner = accounts.get("deployer")!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "update-platform-fee",
                [types.uint(101)], // Above 100%
                contractOwner.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(5)); // ERR-INVALID-PRICE
    },
});

Clarinet.test({
    name: "Contract owner successfully updates minimum ticket price",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const contractOwner = accounts.get("deployer")!;
        const organizer = accounts.get("wallet_1")!;
        
        // Update minimum ticket price
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "update-min-ticket-price",
                [types.uint(5000000)], // 5 STX minimum
                contractOwner.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), "true");
        
        // Try to create event with price below new minimum (should fail)
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Cheap Event"),
                    types.utf8("Event below new minimum"),
                    types.utf8("Budget Venue"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(100),
                    types.uint(2000000), // 2 STX (below new minimum)
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
    name: "Prevents non-owner from updating minimum ticket price",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const unauthorized = accounts.get("wallet_1")!;
        
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "update-min-ticket-price",
                [types.uint(2000000)],
                unauthorized.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(1)); // ERR-NOT-AUTHORIZED
    },
});

Clarinet.test({
    name: "Prevents refund after refund window expires",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer = accounts.get("wallet_2")!;
        
        // Create event with short refund window
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Quick Event"),
                    types.utf8("Event with short refund window"),
                    types.utf8("Time-sensitive Venue"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(100),
                    types.uint(MIN_TICKET_PRICE),
                    types.uint(2), // Very short refund window (2 blocks)
                    types.utf8("Urgent")
                ],
                organizer.address
            )
        ]);
        
        // Purchase ticket
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        // Mine blocks to exceed refund window
        chain.mineEmptyBlock();
        chain.mineEmptyBlock();
        chain.mineEmptyBlock(); // Now beyond refund window
        
        // Try to refund (should fail)
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "refund-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(11)); // ERR-REFUND-WINDOW-CLOSED
    },
});

Clarinet.test({
    name: "Prevents refund of already used tickets",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer = accounts.get("wallet_2")!;
        
        // Create event, purchase and validate ticket
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("No Refund Event"),
                    types.utf8("Event with used tickets"),
                    types.utf8("Final Venue"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(100),
                    types.uint(MIN_TICKET_PRICE),
                    types.uint(1000),
                    types.utf8("Final")
                ],
                organizer.address
            )
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        // Validate ticket first
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "validate-ticket",
                [types.uint(1)],
                organizer.address
            )
        ]);
        
        // Try to refund used ticket (should fail)
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "refund-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(10)); // ERR-TICKET-USED
    },
});

Clarinet.test({
    name: "Prevents validation of refunded tickets",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer = accounts.get("wallet_2")!;
        
        // Create event, purchase and refund ticket
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Refunded Event"),
                    types.utf8("Event with refunded tickets"),
                    types.utf8("Flexible Venue"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(100),
                    types.uint(MIN_TICKET_PRICE),
                    types.uint(1000),
                    types.utf8("Flexible")
                ],
                organizer.address
            )
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "purchase-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        // Refund ticket first
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "refund-ticket",
                [types.uint(1)],
                buyer.address
            )
        ]);
        
        // Try to validate refunded ticket (should fail)
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "validate-ticket",
                [types.uint(1)],
                organizer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(10)); // ERR-TICKET-USED
    },
});

Clarinet.test({
    name: "Handles multiple ticket purchases and complex operations",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer1 = accounts.get("wallet_2")!;
        const buyer2 = accounts.get("wallet_3")!;
        const buyer3 = accounts.get("wallet_4")!;
        
        // Create event with moderate capacity
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "create-event",
                [
                    types.utf8("Complex Event"),
                    types.utf8("Event for complex operations testing"),
                    types.utf8("Multi-purpose Venue"),
                    types.uint(FUTURE_BLOCK),
                    types.uint(10),
                    types.uint(2000000), // 2 STX
                    types.uint(500),
                    types.utf8("Complex")
                ],
                organizer.address
            )
        ]);
        
        // Multiple ticket purchases
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "purchase-ticket", [types.uint(1)], buyer1.address),
            Tx.contractCall(CONTRACT_NAME, "purchase-ticket", [types.uint(1)], buyer2.address),
            Tx.contractCall(CONTRACT_NAME, "purchase-ticket", [types.uint(1)], buyer3.address),
            Tx.contractCall(CONTRACT_NAME, "purchase-ticket", [types.uint(1)], buyer1.address), // Second ticket for buyer1
        ]);
        
        assertEquals(block.receipts.length, 4);
        block.receipts.forEach(receipt => {
            assertEquals(receipt.result.expectOk(), "true");
        });
        
        // Mixed operations: validate some, refund others
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "validate-ticket", [types.uint(1)], organizer.address), // Validate buyer1's first ticket
            Tx.contractCall(CONTRACT_NAME, "refund-ticket", [types.uint(2)], buyer2.address), // Refund buyer2's ticket
            Tx.contractCall(CONTRACT_NAME, "validate-ticket", [types.uint(3)], organizer.address), // Validate buyer3's ticket
        ]);
        
        assertEquals(block.receipts.length, 3);
        assertEquals(block.receipts[0].result.expectOk(), "true"); // Validation success
        assertEquals(block.receipts[1].result.expectOk(), "true"); // Refund success
        assertEquals(block.receipts[2].result.expectOk(), "true"); // Validation success
        
        // Check final event state
        let eventInfo = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-event",
            [types.uint(1)],
            organizer.address
        );
        
        const eventData = eventInfo.result.expectSome().expectTuple();
        assertEquals(eventData["tickets-sold"], types.uint(4)); // 4 tickets were sold
        assertEquals(eventData["revenue"], types.uint(6000000)); // 3 tickets remaining after 1 refund (3 * 2 STX)
        
        // Check individual ticket states
        let ticket1 = chain.callReadOnlyFn(CONTRACT_NAME, "get-ticket", [types.uint(1)], buyer1.address);
        let ticket2 = chain.callReadOnlyFn(CONTRACT_NAME, "get-ticket", [types.uint(2)], buyer2.address);
        let ticket4 = chain.callReadOnlyFn(CONTRACT_NAME, "get-ticket", [types.uint(4)], buyer1.address);
        
        assertEquals(ticket1.result.expectSome().expectTuple()["is-used"], types.bool(true));
        assertEquals(ticket2.result.expectSome().expectTuple()["is-refunded"], types.bool(true));
        assertEquals(ticket4.result.expectSome().expectTuple()["is-used"], types.bool(false)); // Still valid
    },
});

Clarinet.test({
    name: "Handles edge case of ticket operations on non-existent tickets",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer = accounts.get("wallet_2")!;
        
        // Try to validate non-existent ticket
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "validate-ticket",
                [types.uint(999)], // Non-existent ticket
                organizer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(4)); // ERR-TICKET-NOT-FOUND
        
        // Try to refund non-existent ticket
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                "refund-ticket",
                [types.uint(999)], // Non-existent ticket
                buyer.address
            )
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(4)); // ERR-TICKET-NOT-FOUND
        
        // Try to get non-existent ticket info
        let ticketInfo = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-ticket",
            [types.uint(999)],
            buyer.address
        );
        
        assertEquals(ticketInfo.result, types.none());
    },
});

Clarinet.test({
    name: "Verifies read-only functions return correct data",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const organizer = accounts.get("wallet_1")!;
        const buyer = accounts.get("wallet_2")!;
        
        // Test get-event for non-existent event
        let eventInfo = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-event",
            [types.uint(999)],
            organizer.address
        );
        assertEquals(eventInfo.result, types.none());
        
        // Test get-user-tickets for user with no tickets
        let userTickets = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-user-tickets",
            [buyer.address],
            buyer.address
        );
        assertEquals(userTickets.result, types.none());
        
        // Test get-organizer-revenue for organizer with no events
        let organizerRevenue = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "get-organizer-revenue",
            [buyer.address],
            buyer.address
        );
        assertEquals(organizerRevenue.result, types.none());
        
        // Test calculate-platform-fee with default 5%
        let feeCalculation = chain.callReadOnlyFn(
            CONTRACT_NAME,
            "calculate-platform-fee",
            [types.uint(1000000)], // 1 STX
            organizer.address
        );
        assertEquals(feeCalculation.result, types.uint(50000)); // 5% of 1 STX
    },
});

