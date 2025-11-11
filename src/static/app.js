document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const submitBtn = signupForm.querySelector('button[type="submit"]');

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      // Reset activity select (keep the placeholder)
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";
        // store meta for easier updates
        activityCard.dataset.activityName = name;
        activityCard.dataset.maxParticipants = details.max_participants;

        const spotsLeft = details.max_participants - details.participants.length;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p class="availability"><strong>Availability:</strong> <span class="availability-count">${spotsLeft}</span> spots left</p>
          <div class="participants-section">
            <strong>Participants (<span class="participants-count">${details.participants.length}</span>/<span class="participants-max">${details.max_participants}</span>):</strong>
            <ul class="participants-list"></ul>
            <div class="activity-message hidden"></div>
          </div>
        `;

        // Append card and then populate the participants list with buttons
        activitiesList.appendChild(activityCard);

        const ul = activityCard.querySelector('.participants-list');
        const messageEl = activityCard.querySelector('.activity-message');

        if (details.participants.length === 0) {
          const li = document.createElement('li');
          li.innerHTML = '<em>No participants yet</em>';
          ul.appendChild(li);
        } else {
          details.participants.forEach(p => {
            const li = document.createElement('li');
            li.dataset.email = p;

            const span = document.createElement('span');
            span.textContent = p;

            const btn = document.createElement('button');
            btn.className = 'delete-btn';
            btn.title = 'Unregister participant';
            btn.textContent = '✕';
            // store activity name on the button for the handler
            btn.dataset.activity = name;
            btn.dataset.email = p;

            btn.addEventListener('click', async (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const activityName = btn.dataset.activity;
              const email = btn.dataset.email;
              // optimistic disable
              btn.disabled = true;
              try {
                const res = await fetch(
                  `/activities/${encodeURIComponent(activityName)}/unregister?email=${encodeURIComponent(email)}`,
                  { method: 'DELETE' }
                );

                const result = await res.json();
                if (res.ok) {
                  // show inline success and refresh
                  messageEl.textContent = result.message;
                  messageEl.className = 'activity-message success';
                  setTimeout(() => { messageEl.classList.add('hidden'); }, 3000);
                  await fetchActivities();
                } else {
                  console.error('Unregister failed', result);
                  messageEl.textContent = result.detail || 'Failed to unregister participant';
                  messageEl.className = 'activity-message error';
                  setTimeout(() => { messageEl.classList.add('hidden'); }, 5000);
                  btn.disabled = false;
                }
              } catch (err) {
                console.error('Error calling unregister:', err);
                messageEl.textContent = 'Failed to unregister participant';
                messageEl.className = 'activity-message error';
                setTimeout(() => { messageEl.classList.add('hidden'); }, 5000);
                btn.disabled = false;
              }
            });

            li.appendChild(span);
            li.appendChild(btn);
            ul.appendChild(li);
          });
        }

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const activity = document.getElementById("activity").value;

    if (!email || !activity) {
      messageDiv.textContent = 'Please provide an email and select an activity.';
      messageDiv.className = 'error';
      messageDiv.classList.remove('hidden');
      setTimeout(() => messageDiv.classList.add('hidden'), 4000);
      return;
    }

    submitBtn.disabled = true;
    messageDiv.classList.add('hidden');

    // find the activity card to perform optimistic update and show inline messages
    let activityCard = document.querySelector(`.activity-card[data-activity-name="${activity}"]`);
    if (!activityCard) {
      // refetch to ensure UI is present
      await fetchActivities();
      activityCard = document.querySelector(`.activity-card[data-activity-name="${activity}"]`);
    }

    const ul = activityCard ? activityCard.querySelector('.participants-list') : null;
    const countEl = activityCard ? activityCard.querySelector('.participants-count') : null;
    const availEl = activityCard ? activityCard.querySelector('.availability-count') : null;
    const messageEl = activityCard ? activityCard.querySelector('.activity-message') : null;

    // optimistic append
    let pendingLi = null;
    let previousCount = null;
    if (ul && countEl && availEl) {
      previousCount = parseInt(countEl.textContent, 10) || 0;
      const newCount = previousCount + 1;
      countEl.textContent = newCount;
      const max = parseInt(activityCard.dataset.maxParticipants, 10) || 0;
      const newAvail = Math.max(0, max - newCount);
      availEl.textContent = newAvail;

      pendingLi = document.createElement('li');
      pendingLi.className = 'pending';
      pendingLi.dataset.email = email;
      pendingLi.innerHTML = `<span>${email} <em>(pending)</em></span>`;
      ul.appendChild(pendingLi);
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        { method: 'POST' }
      );
      const result = await response.json();

      if (response.ok) {
        // replace pending with final content by refreshing the activity list
        if (messageEl) {
          messageEl.textContent = result.message;
          messageEl.className = 'activity-message success';
          setTimeout(() => { messageEl.classList.add('hidden'); }, 3000);
        } else {
          messageDiv.textContent = result.message;
          messageDiv.className = 'success';
          messageDiv.classList.remove('hidden');
          setTimeout(() => messageDiv.classList.add('hidden'), 3000);
        }
        // refresh entire activities list to get canonical state (this will replace the optimistic entry)
        await fetchActivities();
        signupForm.reset();
      } else {
        // rollback optimistic change
        if (pendingLi && pendingLi.parentElement) pendingLi.remove();
        if (countEl && previousCount !== null) countEl.textContent = previousCount;
        if (availEl && previousCount !== null) {
          const max = parseInt(activityCard.dataset.maxParticipants, 10) || 0;
          availEl.textContent = Math.max(0, max - previousCount);
        }

        if (messageEl) {
          messageEl.textContent = result.detail || 'Failed to sign up';
          messageEl.className = 'activity-message error';
          setTimeout(() => { messageEl.classList.add('hidden'); }, 5000);
        } else {
          messageDiv.textContent = result.detail || 'Failed to sign up';
          messageDiv.className = 'error';
          messageDiv.classList.remove('hidden');
          setTimeout(() => messageDiv.classList.add('hidden'), 5000);
        }
      }
    } catch (error) {
      // rollback optimistic change on network/error
      if (pendingLi && pendingLi.parentElement) pendingLi.remove();
      if (countEl && previousCount !== null) countEl.textContent = previousCount;
      if (availEl && previousCount !== null) {
        const max = parseInt(activityCard.dataset.maxParticipants, 10) || 0;
        availEl.textContent = Math.max(0, max - previousCount);
      }

      if (messageEl) {
        messageEl.textContent = 'Failed to sign up. Please try again.';
        messageEl.className = 'activity-message error';
        setTimeout(() => { messageEl.classList.add('hidden'); }, 5000);
      } else {
        messageDiv.textContent = 'Failed to sign up. Please try again.';
        messageDiv.className = 'error';
        messageDiv.classList.remove('hidden');
      }
      console.error('Error signing up:', error);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Initialize app
  fetchActivities();
});
