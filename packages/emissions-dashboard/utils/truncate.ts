const truncate = (input: string, maxLength: number): string => {
  const trimmedInput = input.substr(0, maxLength);
  const trimmedOnCompleteWord = trimmedInput.substr(
    0,
    Math.min(trimmedInput.length, trimmedInput.lastIndexOf(' ')),
  );
  return trimmedOnCompleteWord + ' ...';
};

export default truncate;
