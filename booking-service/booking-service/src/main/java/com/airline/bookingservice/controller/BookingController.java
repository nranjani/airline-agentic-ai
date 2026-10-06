package com.airline.bookingservice.controller;

import com.airline.bookingservice.model.Booking;
import com.airline.bookingservice.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class BookingController {

    private final BookingService bookingService;

    // GET all bookings
    @GetMapping
    public ResponseEntity<List<Booking>> getAllBookings() {
        return ResponseEntity.ok(bookingService.getAllBookings());
    }

    // GET booking by PNR
    @GetMapping("/{pnr}")
    public ResponseEntity<?> getBookingByPnr(@PathVariable String pnr) {
        return bookingService.getBookingByPnr(pnr)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // POST create a new booking
    @PostMapping
    public ResponseEntity<Booking> createBooking(@Valid @RequestBody Booking booking) {
        Booking created = bookingService.createBooking(booking);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // PUT cancel a booking
    @PutMapping("/{pnr}/cancel")
    public ResponseEntity<?> cancelBooking(@PathVariable String pnr) {
        try {
            Booking cancelled = bookingService.cancelBooking(pnr);
            return ResponseEntity.ok(cancelled);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // POST request a refund
    @PostMapping("/{pnr}/refund")
    public ResponseEntity<?> requestRefund(@PathVariable String pnr) {
        try {
            Booking refund = bookingService.requestRefund(pnr);
            return ResponseEntity.ok(refund);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }
}