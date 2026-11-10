import type { ImportantDay } from "./types";

/**
 * Whose birthday is it today.
 *
 * Birthdays live in Important days (kind "birthday"). Your own is the one
 * titled "My birthday", which Settings writes for you; anything that reads as
 * yours ("My birthday", "мой день рождения", your name) counts too.
 */

export const MY_BIRTHDAY_TITLE = "My birthday";

export interface BirthdayToday {
  id: string;
  /** Who: "you" for your own, otherwise the name pulled from the title. */
  name: string;
  mine: boolean;
  /** How old they turn, when the stored year is a real birth year. */
  age?: number;
}

const OWN = /^(my|мой|моё|мое)(?=\s|$)/i;

export function isMine(d: Pick<ImportantDay, "title">, profileName: string): boolean {
  const t = d.title.trim();
  if (t === MY_BIRTHDAY_TITLE || OWN.test(t)) return true;
  const name = profileName.trim();
  return name.length > 1 && name !== "there" && t.toLowerCase().startsWith(name.toLowerCase());
}

/** "Mum's birthday" → "Mum", "День рождения Алии" → "Алии", "Dana" → "Dana". */
export function personFrom(title: string): string {
  const t = title
    .replace(/[’']s\s+(birthday|bday|b-day)\b.*$/i, "")
    .replace(/\b(birthday|bday|b-day)\b/gi, "")
    .replace(/день\s+рождения|днюха|(^|\s)др(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t || title.trim();
}

export function myBirthday(days: ImportantDay[], profileName: string): ImportantDay | undefined {
  return days.find((d) => d.kind === "birthday" && isMine(d, profileName));
}

export function birthdaysToday(days: ImportantDay[], today: string, profileName: string): BirthdayToday[] {
  const md = today.slice(5);
  return days
    .filter((d) => d.kind === "birthday" && (d.repeatsYearly ? d.date.slice(5) === md : d.date === today))
    .map((d) => {
      const mine = isMine(d, profileName);
      const born = Number(d.date.slice(0, 4));
      const age = Number(today.slice(0, 4)) - born;
      return {
        id: d.id,
        name: mine ? "you" : personFrom(d.title),
        mine,
        age: born > 1900 && age > 0 && age < 120 ? age : undefined,
      };
    })
    .sort((a, b) => Number(b.mine) - Number(a.mine));
}
