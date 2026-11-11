const $ = (root, selector) => root.querySelector(selector);
const DEFAULT_SIGN_IN = 'https://containedevolution.com/';

export function setupCommunity(dialog) {
  const home = $(dialog, '#map-home'), panels = { letters: $(dialog, '#letters-panel'), board: $(dialog, '#board-panel') };
  const lists = { letters: $(dialog, '#letters-list'), board: $(dialog, '#board-list') };
  let justSent = null, user = null, signIn = DEFAULT_SIGN_IN, boardNext = null, boardPosts = [], letters = [], boardLoaded = false, current = null;

  async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, { credentials: 'same-origin', cache: 'no-store', ...options });
    let data; try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) { const error = new Error(data.error || 'Something went wrong. Please try again.'); error.status=response.status; error.signIn=data.signIn; throw error; }
    return data;
  }
  function setSignIn(value) {
    // Sign-in opens Contained Evolution in its own window; coming back here checks the account again.
    // An app on an iPhone's Home Screen keeps its own sign-in, so there it opens in the app's own browser sheet.
    if (value === DEFAULT_SIGN_IN) signIn=value;
    dialog.querySelectorAll('.signin a').forEach(link => { link.href=signIn; if (!navigator.standalone) { link.target='_blank'; link.rel='noopener'; } });
  }
  setSignIn(signIn);
  function notice(panel, message) { const box=$(dialog, `#${panel}-notice`); box.textContent=message || ''; box.hidden=!message; }
  function promptSignIn(panel, path) { setSignIn(path); $(dialog, `#${panel}-signin`).hidden=false; }
  async function checkUser() { const result=await api('/me'); user=result.user; setSignIn(result.signIn); return user; }
  const empty = message => { const p=document.createElement('p'); p.className='empty'; p.textContent=message; return p; };
  function date(value) { const d=new Date(value); return Number.isNaN(d.valueOf()) ? '' : d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); }
  function textNode(tag, className, value) { const el=document.createElement(tag); el.className=className; el.textContent=value || ''; return el; }
  function renderLetters() {
    const list=lists.letters; list.replaceChildren();
    if (!letters.length) { list.append(empty('No letters yet. Patch would love to hear from you!')); return; }
    for (const letter of letters) {
      // Your letter is a paper note with a banana stamp; his reply comes up on the coconut computer's screen.
      const card=document.createElement('article'); card.className='entry letter'+(letter.id&&letter.id===justSent?' just-sent':'');
      const paper=document.createElement('div'); paper.className='letter-paper';
      const stamp=textNode('span','stamp','🍌'); stamp.setAttribute('aria-hidden','true');
      if (letter.lookup) paper.append(textNode('strong','reply-label','Lookup suggestion'));
      paper.append(stamp,textNode('p','entry-date postmark',date(letter.at)),textNode('p','letter-greeting','Dear Patch,'),textNode('p','entry-text',letter.text));
      const reply=document.createElement('div'); reply.className='reply'+(letter.reply?' screen':' waiting');
      if (letter.reply) {
        reply.append(textNode('strong','reply-label','Patch wrote back'),textNode('p','entry-text',letter.reply));
        // He read his reply aloud on the island; this is that recording.
        if (/^[0-9a-z]+$/.test(letter.voice||'')) { const audio=document.createElement('audio'); audio.className='reply-voice'; audio.controls=true; audio.preload='none'; audio.src=`/api/voice/${letter.voice}.mp3`; audio.setAttribute('aria-label','Hear Patch read his reply'); reply.append(textNode('p','entry-date','Hear Patch read it 🐒'),audio); }
        reply.append(textNode('p','entry-date',`Sent from the coconut computer 🥥${letter.repliedAt?' · '+date(letter.repliedAt):''}`));
      } else {
        const dot=textNode('span','waiting-dot',''); dot.setAttribute('aria-hidden','true');
        const label=textNode('strong','reply-label','Waiting at the coconut computer'); label.prepend(dot);
        reply.append(label,textNode('p','entry-date','His tablet pinged him. He’ll write back when he sits down to type.'));
      }
      if (letter.acceptedLookup) reply.append(textNode('p','entry-date','Patch added this question to his research ideas.'));
      card.append(paper,reply); list.append(card);
    }
    justSent=null;
  }
  function renderBoard() {
    const list=lists.board; list.replaceChildren();
    if (!boardLoaded) { list.append(empty('Loading the board…')); return; }
    if (!boardPosts.length) list.append(empty('No messages here yet. Be the first to say hello!'));
    for (const post of boardPosts) {
      const card=document.createElement('article'); card.className='entry post';
      const heading=document.createElement('div'); heading.className='entry-heading';
      heading.append(textNode('strong','entry-name',post.name),textNode('time','entry-date',date(post.at))); card.append(heading,textNode('p','entry-text',post.text));
      const actions=document.createElement('div'); actions.className='entry-actions';
      const report=document.createElement('button'); report.type='button'; report.textContent='Report'; report.setAttribute('aria-label',`Report post by ${post.name}`);
      report.addEventListener('click',()=>moderate(post,'report',report)); actions.append(report);
      if (user?.admin) { const block=document.createElement('button'); block.type='button'; block.textContent='Hide and block'; block.setAttribute('aria-label',`Hide post and block ${post.name}`); block.addEventListener('click',()=>moderate(post,'block',block)); actions.append(block); }
      card.append(actions); list.append(card);
    }
    $(dialog,'#board-more').hidden=!boardNext;
  }
  async function moderate(post, action, button) {
    notice('board',''); button.disabled=true;
    try {
      if (!/^post:[0-9a-z-]+$/.test(post.id)) throw new Error('This post is unavailable.');
      const result=await api(`/board/${post.id}/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
      if (result.hidden || result.blocked) { boardPosts=boardPosts.filter(item=>item.id!==post.id); renderBoard(); notice('board',result.blocked?'Post hidden and author blocked.':'Thank you. The post has been hidden.'); }
      else { button.textContent='Reported'; button.disabled=true; notice('board','Thank you for letting us know.'); }
    } catch(error) { notice('board',error.message); button.disabled=false; }
  }
  async function loadLetters() { lists.letters.replaceChildren(empty('Loading your letters…')); try { letters=(await api('/letters')).letters || []; renderLetters(); } catch(error) { lists.letters.replaceChildren(empty('Your letters could not be loaded.')); notice('letters',error.message); } }
  async function loadBoard(more = false) {
    const button=$(dialog,'#board-more'); button.disabled=true;
    if (!more) { boardLoaded=false; boardPosts=[]; boardNext=null; lists.board.replaceChildren(empty('Loading the board…')); }
    try { const result=await api('/board'+(more&&boardNext?'?before='+encodeURIComponent(boardNext):'')); const known=new Set(boardPosts.map(p=>p.id)); boardPosts.push(...(result.posts||[]).filter(p=>!known.has(p.id))); boardNext=result.next || null; boardLoaded=true; renderBoard(); }
    catch(error) { if(!more) lists.board.replaceChildren(empty('The board could not be loaded.')); notice('board',error.message); }
    finally { button.disabled=false; }
  }
  const sections = () => dialog.querySelectorAll('section.community');
  const menu = $(dialog, '#island-menu');
  function showPanel(name) {
    current=name;
    home.hidden=name!=='map';
    sections().forEach(panel=>{ panel.hidden=panel.id!==`${name}-panel`; });
    if (menu) {
      for (const button of menu.querySelectorAll('button[aria-current]')) button.removeAttribute('aria-current');
      const selected = name === 'page' ? `#open-${$(dialog, '#island-page').dataset.page}` : `[data-panel="${name}"]`;
      $(menu, selected)?.setAttribute('aria-current', 'true');
      if (name !== 'page') {
        const frame = $(dialog, '#island-page');
        if (frame.hasAttribute('src')) frame.removeAttribute('src');
        delete frame.dataset.page;
      }
    }
    dialog.scrollTop=0;
    const focus = name === 'map' ? $(dialog, '#open-island-map') : $(dialog,`#${name}-title`);
    focus?.focus({preventScroll:true});
  }
  async function openPanel(name) {
    user=null;
    if(name==='letters') { letters=[]; renderLetters(); $(dialog,'#letter-form').hidden=true; }
    showPanel(name); notice(name,'');
    $(dialog,`#${name}-signin`).hidden=true;
    if(name==='board') loadBoard();
    try { await checkUser(); if(name==='letters') { if(user) await loadLetters(); else {letters=[];renderLetters(); $(dialog,'#letter-text').value=''; $(dialog,'#letter-text').dispatchEvent(new Event('input'));} } else renderBoard(); }
    catch(error) { user=null; if(name==='letters') {letters=[];renderLetters();} else if(boardLoaded) renderBoard(); notice(name,error.message); }
  }
  for(const name of ['letters','board']) $(dialog,`#open-${name}`).addEventListener('click',()=>openPanel(name));
  dialog.querySelectorAll('.back-map').forEach(button=>button.addEventListener('click',()=>{ sections().forEach(panel=>panel.hidden=true); current=null; const active=button.closest('section').id.replace(/-panel$/,''); home.hidden=false; dialog.scrollTop=0; $(dialog,`#open-${active}`)?.focus(); }));
  dialog.addEventListener('close',()=>{
    if (dialog.open) return;
    if (menu) showPanel('map');
    else { sections().forEach(panel=>panel.hidden=true); current=null; home.hidden=false; }
  });
  // Back from signing in: if this panel was asking for an account, look again.
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && panels[current] && !$(dialog,`#${current}-signin`).hidden) openPanel(current); });
  const letterKind = $(dialog, '#letter-kind');
  const letterInput = $(dialog, '#letter-text');
  const letterPlaceholder = letterInput.placeholder;
  letterKind.addEventListener('change', () => {
    const lookup = letterKind.value === 'lookup';
    $(dialog, '#letter-label').textContent = lookup ? 'What should Patch look up?' : 'Dear Patch,';
    $(dialog, '#lookup-hint').hidden = !lookup;
    letterInput.maxLength = lookup ? 120 : 1000;
    letterInput.placeholder = lookup ? 'Why do hermit crabs change shells?' : letterPlaceholder;
    letterInput.dispatchEvent(new Event('input'));
  });
  for (const [name,max] of [['letter',1000],['board',280]]) {
    const input=$(dialog,`#${name}-text`), counter=$(dialog,`#${name}-count`);
    input.addEventListener('input',()=>{ const limit=input.maxLength || max; counter.textContent=`${input.value.length} / ${limit}`+(name==='board'?' · No links':''); counter.classList.toggle('near',input.value.length>limit*.9); });
  }
  $(dialog,'#write-letter').addEventListener('click',async()=>{
    notice('letters','');
    try { if(!await checkUser()) {promptSignIn('letters');return;} $(dialog,'#letters-signin').hidden=true; $(dialog,'#letter-form').hidden=false; $(dialog,'#letter-text').focus(); await loadLetters(); }
    catch(error){notice('letters',error.message);}
  });
  for(const [name,path,field] of [['letter','/letters','letter'],['board','/board','post']]) {
    const form=$(dialog,`#${name}-form`), panel=name==='letter'?'letters':'board';
    form.addEventListener('submit',async event=>{
      event.preventDefault(); notice(panel,''); const button=form.querySelector('button[type="submit"]'); button.disabled=true;
      try {
        if(!await checkUser()){promptSignIn(panel);return;}
        $(dialog,`#${panel}-signin`).hidden=true;
        const input=$(dialog,`#${name}-text`);
        if (input.value.length > input.maxLength) throw new Error(`Keep your message under ${input.maxLength + 1} characters.`);
        const result=await api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:input.value, ...(field==='letter' && {lookup:letterKind.value==='lookup'})})});
        if (field==='letter') { letterKind.value='letter'; letterKind.dispatchEvent(new Event('change')); }
        input.value=''; input.dispatchEvent(new Event('input'));
        if(field==='letter'){justSent=result.letter?.id;letters.unshift(result.letter);renderLetters();notice(panel,'✉ Your letter is on its way to Patch’s coconut computer.');}
        else {boardPosts.unshift(result.post);renderBoard();notice(panel,'Your message is on the board.');}
      } catch(error) { notice(panel,error.message); if(error.status===401) promptSignIn(panel,error.signIn); }
      finally {button.disabled=false;}
    });
  }
  $(dialog,'#board-more').addEventListener('click',()=>loadBoard(true));
  return { openPanel, showPanel };
}
