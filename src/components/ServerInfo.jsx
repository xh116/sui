const handleRightClick = async (e, node) => {
  e.preventDefault();

  try {
    const ip = node?.ip || node?.metadata?.destinationIP;
    if (!ip) return;

    const res = await fetch(`https://ipwho.de/json/${ip}`);
    const data = await res.json();

    const title = `${data.country_code} ${data.country_name} ⋅ ${data.city_name || ""}`;
    const subtitle = `${data.as_desc}｜${data.ip} ⬩ AS${data.asn}`;
    const description = `─────────────
Country: ${data.country_name}
City: ${data.city_name}
Org: ${data.as_desc}
IP: ${data.ip}
ASN: AS${data.asn}
─────────────`;

    setServerInfo({ title, subtitle, description });
  } catch (err) {
    console.error("Failed to fetch server info", err);
  }
};
