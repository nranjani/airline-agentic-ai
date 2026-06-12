package com.airline.bookingservice.repository;

import com.airline.bookingservice.model.Booking;
import com.airline.bookingservice.model.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByPnr(String pnr);

    List<Booking> findByPassengerName(String passengerName);

    List<Booking> findByStatus(BookingStatus status);

    boolean existsByPnr(String pnr);
}