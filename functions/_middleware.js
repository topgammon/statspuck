// Keep staging and preview copies out of search results. Only statspuck.com is indexed.
export async function onRequest(context) {
  const response = await context.next();
  const host = new URL(context.request.url).hostname;
  if (host !== "statspuck.com" && host !== "www.statspuck.com") {
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  return response;
}
