import countries from "flag-icons/country.json";

// Include every named flag in the bundled collection, including territories.
export const flags = countries.map(({ code, name }) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));
export const flagNames = new Map(flags.map(flag => [flag.code, flag.name]));
const assets = import.meta.glob<string>("../../node_modules/flag-icons/flags/4x3/*.svg", {
  eager: true, query: "?url&no-inline", import: "default",
});
export function flagImage(code: string) {
  return assets[`../../node_modules/flag-icons/flags/4x3/${code}.svg`];
}
