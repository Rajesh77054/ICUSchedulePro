import { User, Holiday } from "./types";

export const USERS: User[] = [
  // Physicians
  {
    id: 1,
    name: "Ashley Liou",
    title: "MD",
    userType: "physician",
    targetDays: 105,
    tolerance: 7,
    maxConsecutiveWeeks: 1,
    color: "hsl(230, 75%, 60%)",
  },
  {
    id: 2,
    name: "Joseph Brading",
    title: "MD",
    userType: "physician",
    targetDays: 170,
    maxConsecutiveWeeks: 2,
    color: "hsl(160, 75%, 40%)",
  },
  {
    id: 3,
    name: "Rajesh Harrykissoon",
    title: "MD",
    userType: "physician",
    targetDays: 62,
    maxConsecutiveWeeks: 1,
    color: "hsl(350, 75%, 50%)",
  },
  // APPs
  {
    id: 4,
    name: "Sarah Johnson",
    title: "NP",
    userType: "app",
    targetDays: 180,
    maxConsecutiveWeeks: 2,
    color: "hsl(45, 75%, 45%)",
  },
  {
    id: 5,
    name: "Michael Chen",
    title: "PA",
    userType: "app",
    targetDays: 180,
    maxConsecutiveWeeks: 2,
    color: "hsl(290, 75%, 45%)",
  },
];

export const HOLIDAYS_2024_2025: Holiday[] = [
  { name: "New Year's Day", date: "2024-01-01" },
  { name: "Memorial Day", date: "2024-05-27" },
  { name: "Independence Day", date: "2024-07-04" },
  { name: "Labor Day", date: "2024-09-02" },
  { name: "Thanksgiving", date: "2024-11-28" },
  { name: "Christmas", date: "2024-12-25" },
  { name: "New Year's Day", date: "2025-01-01" },
];