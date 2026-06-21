// 観測情報の投稿を受け取って、データベースに保存する(承認待ち状態)
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const data = await request.json();

    const { lat, lng, date, note } = data;

    // 入力チェック
    if (typeof lat !== "number" || typeof lng !== "number" || !date) {
      return new Response(JSON.stringify({ error: "入力内容が不正です" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 富良野地区のおおよその範囲チェック(緯度経度のざっくりした範囲)
    const inFuranoArea =
      lat >= 42.9 && lat <= 43.7 &&
      lng >= 142.0 && lng <= 142.9;

    if (!inFuranoArea) {
      return new Response(JSON.stringify({ error: "富良野地区周辺の座標を指定してください" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // メモが長すぎる場合は弾く(荒らし対策の一環)
    if (note && note.length > 300) {
      return new Response(JSON.stringify({ error: "メモは300文字以内にしてください" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await env.DB.prepare(
      `INSERT INTO sightings (lat, lng, observed_date, note, status) VALUES (?, ?, ?, ?, 'pending')`
    ).bind(lat, lng, date, note || "").run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "サーバーエラーが発生しました" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
