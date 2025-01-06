import { Provider } from "./types";

export const PROVIDERS: Provider[] = [
  {
    id: 1,
    name: "Ashley Liou",
    title: "MD",
    targetDays: 105,
    tolerance: 7,
    maxConsecutiveWeeks: 1,
    color: "hsl(230, 75%, 60%)",
  },
  {
    id: 2,
    name: "Joseph Brading",
    title: "MD", 
    targetDays: 170,
    maxConsecutiveWeeks: 2,
    color: "hsl(160, 75%, 40%)",
  },
  {
    id: 3,
    name: "Rajesh Harrykissoon",
    title: "MD",
    targetDays: 62,
    maxConsecutiveWeeks: 1,
    color: "hsl(350, 75%, 50%)",
  },
  {
    id: 4, 
    name: "Anthony Zachria",
    title: "DO",
    targetDays: 28,
    maxConsecutiveWeeks: 1,
    color: "hsl(45, 75%, 45%)",
  },
];

export const HOLIDAYS_2024_2025 = [
  { name: "New Year's Day", date: "2024-01-01" },
  { name: "Memorial Day", date: "2024-05-27" },
  { name: "Independence Day", date: "2024-07-04" },
  { name: "Labor Day", date: "2024-09-02" },
  { name: "Thanksgiving", date: "2024-11-28" },
  { name: "Christmas", date: "2024-12-25" },
  { name: "New Year's Day", date: "2025-01-01" },
];
