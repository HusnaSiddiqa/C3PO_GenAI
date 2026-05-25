import { trim } from 'lodash';

export async function fetchReadme(): Promise<string> {
  const response = await fetch("/v2/admin/ui/readme");

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  let responseText: string = '';

  try {
    responseText = trim(await response.text(), '"')
      .replaceAll("\\n", "\n");
  } catch (error) {
    console.error("Failed to fetch readme", error);
  }

  return responseText;
}