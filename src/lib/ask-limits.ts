// Ask the Lab's limits, apart from src/lib/ask.ts so the chat can use them
// without pulling the Lab's knowledge into the browser bundle.

export const MAX_TURNS = 12;
export const MAX_CHARS = 1000;

export type Turn = { role: "user" | "assistant"; content: string };
