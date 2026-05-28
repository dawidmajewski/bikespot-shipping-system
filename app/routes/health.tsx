import type { LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return Response.json(
    {
      ok: true,
      timestamp: new Date().toISOString(),
      url: request.url,
    },
    { status: 200 }
  );
};