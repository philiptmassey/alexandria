export const stripUrlArguments = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const queryIndex = trimmed.indexOf("?");
  const hashIndex = trimmed.indexOf("#");
  let endIndex = trimmed.length;

  if (queryIndex >= 0) {
    endIndex = Math.min(endIndex, queryIndex);
  }
  if (hashIndex >= 0) {
    endIndex = Math.min(endIndex, hashIndex);
  }

  return trimmed.slice(0, endIndex);
};
