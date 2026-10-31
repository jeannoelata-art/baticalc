// Démarre un paiement Chariow. La clé secrète vient de Vercel (variable CHARIOW_API_KEY), jamais du code.
const OFFRES = require("./_offres");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { return res.status(405).json({ erreur: "Méthode non autorisée." }); }
  const cleApi = process.env.CHARIOW_API_KEY;
  if (!cleApi) { return res.status(500).json({ erreur: "Paiement non configuré." }); }

  const b = req.body || {};
  const offre = OFFRES[String(b.offre || "")];
  const prenom = String(b.prenom || "").trim().slice(0, 50);
  const nom = String(b.nom || "").trim().slice(0, 50);
  const email = String(b.email || "").trim().toLowerCase().slice(0, 255);
  let tel = String(b.tel || "").replace(/\D/g, "");
  if (tel.length === 12 && tel.startsWith("237")) { tel = tel.slice(3); }

  if (!offre) { return res.status(400).json({ erreur: "Offre inconnue." }); }
  if (!prenom || !nom) { return res.status(400).json({ erreur: "Entrez votre prénom et votre nom." }); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { return res.status(400).json({ erreur: "Adresse e-mail non valide." }); }
  if (tel.length !== 9) { return res.status(400).json({ erreur: "Le numéro doit avoir 9 chiffres (ex : 699000000)." }); }

  const site = process.env.SITE_URL || ("https://" + req.headers.host);
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();

  try {
    const r = await fetch("https://api.chariow.com/v1/checkout", {
      method: "POST",
      headers: { "Authorization": "Bearer " + cleApi, "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: offre.id,
        email: email,
        first_name: prenom,
        last_name: nom,
        phone: { number: tel, country_code: "CM" },
        redirect_url: site + "/?paiement=ok",
        customer_ip: ip || undefined,
        custom_metadata: { offre: String(b.offre), source: "baticalc" }
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Chariow checkout", r.status, j && j.message);
      return res.status(400).json({ erreur: (j && j.message) || "Le paiement n'a pas pu démarrer." });
    }
    const url = j && j.data && j.data.payment && j.data.payment.checkout_url;
    if (!url) { return res.status(502).json({ erreur: "Pas de page de paiement reçue. Réessayez." }); }
    return res.status(200).json({ url: url });
  } catch (e) {
    console.error("acheter", e);
    return res.status(502).json({ erreur: "Service de paiement injoignable. Réessayez." });
  }
};
