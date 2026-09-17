export { cn } from "cn"

// 1 -> "01", for step and item numbers.
export const pad2 = (n: number) => String(n).padStart(2, "0");
