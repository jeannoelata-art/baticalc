// Vérifie une clé de licence auprès de Chariow (scope licenses.read).
const OFFRES = require("./_offres");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { return res.status(405).json({ erreur: "Méthode non autorisée." }); }
  const cleApi = process.env.CHARIOW_API_KEY;
  if (!cleApi) { return res.status(500).json({ erreur: "Vérification non configurée." }); }

  const cle = String((req.body && req.body.cle) || "").trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(cle)) { return res.status(400).json({ valide: false, erreur: "Clé non valide." }); }

  try {
    const r = await fetch("https://api.chariow.com/v1/licenses?per_page=20&search=" + encodeURIComponent(cle), {
      headers: { "Authorization": "Bearer " + cleApi }
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Chariow licences", r.status, j && j.message);
      return res.status(502).json({ erreur: "Vérification impossible pour le moment. Réessayez." });
    }
    // La recherche renvoie des clés proches : on exige la clé exacte.
    const lic = (j.data || []).find((x) => x && x.license && x.license.key === cle);
    if (!lic) { return res.status(200).json({ valide: false, erreur: "Clé introuvable. Vérifiez qu'elle est bien copiée en entier." }); }

    const offre = Object.keys(OFFRES).find((k) => OFFRES[k].id === (lic.product && lic.product.id));
    if (!offre) { return res.status(200).json({ valide: false, erreur: "Cette clé ne correspond à aucune offre BatiCalc." }); }

    const statut = lic.status;
    const exp = lic.expires_at ? Date.parse(lic.expires_at) : null;
    const expire = exp !== null && exp <= Date.now();
    const valide = (statut === "active" || statut === "pending_activation") && !expire;

    let erreur;
    if (!valide) {
      erreur = statut === "revoked" ? "Cette clé a été annulée."
        : (statut === "expired" || expire) ? "Cette clé a expiré."
        : "Cette clé n'est pas utilisable.";
    }
    return res.status(200).json({
      valide: valide,
      erreur: erreur,
      statut: statut,
      offre: offre,
      jours: OFFRES[offre].jours,
      expire_le: lic.expires_at || null
    });
  } catch (e) {
    console.error("verifier", e);
    return res.status(502).json({ erreur: "Service injoignable. Réessayez." });
  }
};
                                               
