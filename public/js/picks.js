document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.matchup').forEach((row) => {
    const gameId = row.dataset.gameId;
    row.querySelectorAll('.team-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        const side = btn.dataset.side;

        row.querySelectorAll('.team-btn').forEach((b) => b.disabled = true);

        try {
          const weekId = window.location.pathname.split('/').filter(Boolean).pop();
          const res = await fetch(`/weeks/${weekId}/picks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId, side }),
          });
          const data = await res.json();
          if (!data.ok) {
            alert(data.error || 'Could not save pick.');
            window.location.reload();
            return;
          }
          row.querySelectorAll('.team-btn').forEach((b) => {
            b.classList.toggle('picked', b.dataset.side === side);
            b.disabled = false;
          });
        } catch (err) {
          alert('Network error — could not save pick.');
          window.location.reload();
        }
      });
    });
  });
});
