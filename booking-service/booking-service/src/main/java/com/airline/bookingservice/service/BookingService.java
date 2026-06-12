package com.airline.bookingservice.service;

import com.airline.bookingservice.model.Booking;
import com.airline.bookingservice.model.BookingStatus;
import com.airline.bookingservice.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;

    // Create a new booking
    public Booking createBooking(Booking booking) {
        // Generate a random 6-character PNR
        String pnr = UUID.randomUUID()
                .toString()
                .substring(0, 6)
                .toUpperCase();
        booking.setPnr(pnr);
        booking.setStatus(BookingStatus.CONFIRMED);
        return bookingRepository.save(booking);
    }

    // Get booking by PNR
    public Optional<Booking> getBookingByPnr(String pnr) {
        return bookingRepository.findByPnr(pnr);
    }

    // Get all bookings
    public List<Booking> getAllBookings() {
        return bookingRepository.findAll();
    }

    // Cancel a booking
    public Booking cancelBooking(String pnr) {
        Booking booking = bookingRepository.findByPnr(pnr)
                .orElseThrow(() -> new RuntimeException("Booking not found: " + pnr));

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new RuntimeException("Booking is already cancelled");
        }

        // Basic Economy cannot be cancelled after booking
        if (booking.getFareType().equalsIgnoreCase("Basic Economy")) {
            throw new RuntimeException(
                    "Basic Economy tickets cannot be cancelled. " +
                            "Only travel credit is available within 24 hours of booking."
            );
        }

        booking.setStatus(BookingStatus.CANCELLED);
        return bookingRepository.save(booking);
    }

    // Request a refund
    public Booking requestRefund(String pnr) {
        Booking booking = bookingRepository.findByPnr(pnr)
                .orElseThrow(() -> new RuntimeException("Booking not found: " + pnr));

        if (booking.getStatus() != BookingStatus.CANCELLED) {
            throw new RuntimeException(
                    "Booking must be cancelled before requesting a refund"
            );
        }

        if (booking.getFareType().equalsIgnoreCase("Basic Economy")) {
            throw new RuntimeException(
                    "Basic Economy tickets are non-refundable"
            );
        }

        booking.setStatus(BookingStatus.REFUND_PENDING);
        return bookingRepository.save(booking);
    }
}