import { User, Holiday } from "./types";

// Default empty users array
export const DEFAULT_USERS: User[] = [];

export let USERS = DEFAULT_USERS;

// Function to update users
export function updateUsers(newUsers: User[]) {
  USERS = newUsers;
}

export const HOLIDAYS_2024_2025: Holiday[] = [
  { name: "New Year's Day", date: "2024-01-01" },
  { name: "Memorial Day", date: "2024-05-27" },
  { name: "Independence Day", date: "2024-07-04" },
  { name: "Labor Day", date: "2024-09-02" },
  { name: "Thanksgiving", date: "2024-11-28" },
  { name: "Christmas", date: "2024-12-25" },
  { name: "New Year's Day", date: "2025-01-01" },
];