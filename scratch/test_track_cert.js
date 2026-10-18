async function runTest() {
  const adminEmail = (process.env.ADMIN_EMAILS || "").split(",")[0] || "victorychibuakunna@gmail.com";
  
  // 1. Get track description
  console.log("--- 1. Get description for 'python programming' ---");
  const res1 = await fetch("http://localhost:3000/api/certificate/track-description?track=python%20programming");
  const d1 = await res1.json();
  console.log("Track:", d1.trackName, "| Is custom:", d1.isCustom);

  // 2. Update description for 'python programming'
  console.log("--- 2. Updating description for 'python programming' ---");
  const customText = "The participant has demonstrated advanced mastery of Python, algorithms, data structures, and practical software engineering principles during the 30-day challenge.";
  
  const res2 = await fetch("http://localhost:3000/api/certificate/track-description", {
    method: "PUT",
    headers: {
      "X-User-Email": adminEmail,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      trackName: "python programming",
      description: customText,
    }),
  });
  const d2 = await res2.json();
  console.log("Update status:", res2.status, d2.message);

  // 3. Temporarily approve Chukwuemeka Victor (who is in python programming)
  const id = "d0fbbf24-9da0-4fbf-9e6c-9e66bd4cb89e";
  await fetch(`http://localhost:3000/api/registrations/${id}/approve-certificate`, {
    method: "POST",
    headers: { "X-User-Email": adminEmail, "Content-Type": "application/json" },
    body: JSON.stringify({ approved: true }),
  });

  // 4. Check certificate for participant
  console.log("--- 3. Check certificate for candidate in python programming ---");
  const res3 = await fetch("http://localhost:3000/api/certificate", {
    headers: { "X-User-Email": "devemmy001@gmail.com" },
  });
  const d3 = await res3.json();
  console.log("Eligible:", d3.eligible);
  console.log("Candidate track:", d3.participant?.techSkill);
  console.log("Certificate body text:", d3.template?.bodyText);
  console.log("Matches custom text?:", d3.template?.bodyText === customText);

  // Clean up: revoke approval
  await fetch(`http://localhost:3000/api/registrations/${id}/approve-certificate`, {
    method: "POST",
    headers: { "X-User-Email": adminEmail, "Content-Type": "application/json" },
    body: JSON.stringify({ approved: false }),
  });
  console.log("--- Test completed and cleaned up successfully! ---");
}

runTest().catch(console.error);
