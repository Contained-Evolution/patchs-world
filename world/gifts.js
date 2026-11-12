const status = document.querySelector('#status');
const signIn = document.querySelector('#sign-in');
const meal = document.querySelector('#send-meal');
const ball = document.querySelector('#send-ball');
const hoodie = document.querySelector('#send-hoodie');
const stage = document.querySelector('.ball-stage');
const shape = stage.querySelector('.ball');
let state;

function render() {
  meal.disabled = !state?.canSendMeal;
  ball.disabled = !state?.canSendBall;
  document.querySelector('#hoodie-gift').hidden = !state?.canOfferHoodie;
  hoodie.disabled = !state?.canOfferHoodie || Boolean(state.hoodie);
  document.querySelector('#hoodie-state').textContent = ({
    waiting: 'Your hoodie is waiting at camp.',
    worn: 'Patch put on your hoodie.',
  })[state?.hoodie] || '';
  const wear = state?.ball?.wear || 0;
  stage.style.setProperty('--wear', wear);
  stage.style.setProperty('--bounce', `${62 - wear * 53}px`);
  ball.textContent = state?.ball ? 'Offer a replacement' : 'Leave a ball';
  document.querySelector('#meal-state').textContent = ({
    waiting: 'Your banana is waiting at camp.',
    eaten: 'Patch ate your banana.',
  })[state?.meal] || '';
  const note = ({
    waiting: 'Your ball is waiting at camp.',
    accepted: 'Patch kept your ball.',
    'kept-old': 'Patch chose to keep his old ball.',
    replaced: 'Patch swapped his old ball for your new one.',
  })[state?.offer];
  document.querySelector('#ball-state').textContent = [
    note, state?.ball && `${state.ball.condition}. Times played: ${state.ball.plays}.`,
  ].filter(Boolean).join(' ');
}

async function update(kind) {
  meal.disabled = ball.disabled = hoodie.disabled = true;
  status.textContent = kind ? 'Leaving your gift…' : 'Checking your gifts…';
  try {
    const response = await fetch('./api/gifts', kind && {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    });
    const result = await response.json().catch(() => ({}));
    signIn.hidden = response.status !== 401;
    if (!signIn.hidden) {
      state = null;
      status.textContent = '';
      return;
    }
    if (!response.ok) throw new Error(result.error || 'The camp drop-off couldn’t load. Try refreshing.');
    state = result;
    status.textContent = kind ? 'Your gift is at camp.' : '';
  } catch (error) {
    status.textContent = error.message || 'The camp drop-off couldn’t load.';
  } finally {
    render();
  }
}

meal.addEventListener('click', () => update('meal'));
ball.addEventListener('click', () => update('ball'));
hoodie.addEventListener('click', () => update('hoodie'));
document.querySelector('#preview-ball').addEventListener('click', () => {
  shape.classList.remove('bouncing');
  requestAnimationFrame(() => requestAnimationFrame(() => shape.classList.add('bouncing')));
});
update();
