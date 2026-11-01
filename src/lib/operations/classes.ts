export type ClassBookingStatus = "BOOKED" | "WAITLISTED";

export function getClassBookingStatus(capacity: number, bookedCount: number): ClassBookingStatus {
  if (!Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(bookedCount) || bookedCount < 0) {
    throw new Error("Invalid class capacity or booking count.");
  }

  return bookedCount < capacity ? "BOOKED" : "WAITLISTED";
}
