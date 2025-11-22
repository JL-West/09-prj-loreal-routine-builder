export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/generateRoutine") {
      try {
        const payload = await request.json();
        const products = payload.products || [];
        const citations = payload.citations || [];

        // Build messages for OpenAI chat completion
        const system = {
          role: "system",
          content:
            "You are a helpful beauty assistant. Given selected products and optional web citations, create a clear Morning and Evening routine in Markdown. Prioritize safety and label any uncertainty.",
        };

        const userContent = `Selected products:\n${JSON.stringify(
          products,
          null,
          2
        )}\n\nCitations:\n${JSON.stringify(citations, null, 2)}`;
        const user = { role: "user", content: userContent };

        const body = {
          model: "gpt-4o",
          messages: [system, user],
          max_tokens: 700,
        };

        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify(body),
        });

        const data = await resp.json();
        const text = data?.choices?.[0]?.message?.content || null;

        return new Response(JSON.stringify({ routine: text, raw: data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
