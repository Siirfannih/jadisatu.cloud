// Morning Briefing Flow - 4 Step Interactive Questionnaire

const BriefingManager = {
  currentStep: 1,
  data: {
    clarity_level: 3,
    priority_task: null,
    blockers: []
  },

  // Initialize morning briefing
  init() {
    console.log('[BRIEFING] Initializing morning briefing...');
    this.currentStep = 1;
    this.data = { clarity_level: 3, priority_task: null, blockers: [] };
    this.showStep(1);
  },

  // Show specific step
  showStep(step) {
    console.log('[BRIEFING] Showing step:', step);

    // Hide all steps
    for (let i = 1; i <= 4; i++) {
      const stepEl = document.getElementById(`briefing-q${i}`);
      if (stepEl) stepEl.classList.add('hidden');
    }

    // Show current step
    const currentStepEl = document.getElementById(`briefing-q${step}`);
    if (currentStepEl) {
      currentStepEl.classList.remove('hidden');
    }

    // Update progress indicator
    this.updateProgress(step);

    this.currentStep = step;
  },

  // Update progress indicator
  updateProgress(step) {
    for (let i = 1; i <= 4; i++) {
      const indicator = document.getElementById(`briefing-progress-${i}`);
      if (indicator) {
        if (i <= step) {
          indicator.classList.add('bg-work');
          indicator.classList.remove('bg-gray-700');
        } else {
          indicator.classList.remove('bg-work');
          indicator.classList.add('bg-gray-700');
        }
      }
    }
  },

  // Update clarity level
  updateClarity(value) {
    this.data.clarity_level = parseInt(value);
    const labels = {
      1: 'Sangat Buram',
      2: 'Agak Buram',
      3: 'Cukup Jernih',
      4: 'Jernih',
      5: 'Sangat Jernih'
    };

    const label = document.getElementById('clarity-label');
    if (label) label.textContent = labels[value] || 'Cukup Jernih';

    console.log('[BRIEFING] Clarity level:', value);
  },

  // Select priority task
  selectPriority(element, taskText) {
    // Remove selection from all options
    document.querySelectorAll('.priority-btn').forEach(btn => {
      btn.classList.remove('border-work', 'bg-work/10');
      btn.classList.add('border-gray-700', 'bg-gray-800/50');

      const circle = btn.querySelector('.check-circle');
      if (circle) {
        circle.classList.remove('bg-work', 'border-work');
        circle.classList.add('border-gray-600');
      }
    });

    // Mark selected option
    element.classList.remove('border-gray-700', 'bg-gray-800/50');
    element.classList.add('border-work', 'bg-work/10');

    const circle = element.querySelector('.check-circle');
    if (circle) {
      circle.classList.remove('border-gray-600');
      circle.classList.add('bg-work', 'border-work');
    }

    this.data.priority_task = taskText;
    console.log('[BRIEFING] Priority selected:', taskText);
  },

  // Toggle blocker selection
  toggleBlocker(element, blockerText) {
    const isSelected = element.classList.contains('border-warning');

    if (isSelected) {
      // Deselect
      element.classList.remove('border-warning', 'bg-warning/10');
      element.classList.add('border-gray-700', 'bg-gray-800/50');
      this.data.blockers = this.data.blockers.filter(b => b !== blockerText);
    } else {
      // Select
      element.classList.remove('border-gray-700', 'bg-gray-800/50');
      element.classList.add('border-warning', 'bg-warning/10');
      this.data.blockers.push(blockerText);
    }

    console.log('[BRIEFING] Blockers:', this.data.blockers);
  },

  // Navigate to next step
  nextStep(targetStep) {
    // Validation
    if (this.currentStep === 2 && !this.data.priority_task) {
      showToast('Please select a priority task', 'warning');
      return;
    }

    this.showStep(targetStep);
  },

  // Navigate to previous step
  prevStep(targetStep) {
    this.showStep(targetStep);
  },

  // Finish and save briefing
  async finish() {
    console.log('[BRIEFING] Finishing briefing with data:', this.data);

    // Show final quote
    this.showStep(4);

    // Save to database
    try {
      await DataService.saveMorningBriefing(this.data);

      // Save completion date to localStorage
      localStorage.setItem('briefingDate', new Date().toDateString());

      console.log('[BRIEFING] Saved successfully');

      // Close after 3 seconds
      setTimeout(() => {
        this.close();
        showToast('Morning briefing completed! Have a great day 🚀', 'success');
      }, 3000);

    } catch (error) {
      console.error('[BRIEFING] Save error:', error);
      showToast('Failed to save briefing', 'error');
    }
  },

  // Close briefing modal
  close() {
    const modal = document.getElementById('morning-briefing');
    if (modal) {
      modal.classList.add('hidden');
    }
  }
};

// Global functions for HTML onclick handlers
function updateClarity(value) {
  BriefingManager.updateClarity(value);
}

function selectPriority(element, text) {
  BriefingManager.selectPriority(element, text);
}

function toggleBlocker(element, text) {
  BriefingManager.toggleBlocker(element, text);
}

function nextBriefing(step) {
  BriefingManager.nextStep(step);
}

function prevBriefing(step) {
  BriefingManager.prevStep(step);
}

function finishBriefing() {
  BriefingManager.finish();
}

function closeBriefingModal() {
  BriefingManager.close();
}

// Show morning briefing if not done today
function showMorningBriefingModal() {
  const modal = document.getElementById('morning-briefing');
  if (modal) {
    modal.classList.remove('hidden');
    BriefingManager.init();
  }
}
