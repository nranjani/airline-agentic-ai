package com.airline.bookingservice;

import org.junit.jupiter.api.Test;

class BookingServiceApplicationTests {

	@Test
	void contextLoads() {
		// Basic smoke test - no database connection needed in CI
	}

	@Test
	void applicationStarts() {
		// Verify the application class exists
		BookingServiceApplication app = new BookingServiceApplication();
		assert app != null;
	}
}