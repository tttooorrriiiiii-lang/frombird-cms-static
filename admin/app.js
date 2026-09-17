import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = "https://mqfrarevndipfspmmjas.supabase.co";
const SUPABASE_KEY = "sb_publishable_pRNrkiBawWg3ipTv4lSvsg_6cOlOU6z";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  user: null, recovery: false, tab: "contents",
  categories: [], contents: [], news: [],
  editingContent: null, editingNews: null, editingCategory: null,
  message: "", isError: false
};
const app = document.querySelector("#app");

const esc = (s="") => String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
const catName = id => state.categories.find(c=>c.id===id)?.name || "未分類";
const isAdmin = user => user?.app_metadata?.role === "admin";
const flash = (message, isError=false) => { state.message=message; state.isError=isError; };

async function refresh(){
  const [cats,items,updates] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("contents").select("*").order("sort_order"),
    supabase.from("news").select("*").order("published_at",{ascending:false,nullsFirst:false})
  ]);
  if(cats.error || items.error || updates.error){
    flash((cats.error||items.error||updates.error)?.message || "読み込みに失敗しました", true);
  }
  state.categories=cats.data||[];
  state.contents=items.data||[];
  state.news=updates.data||[];
}

function authMessage(text, err=false){
  const el=document.querySelector("#authMessage");
  if(!el)return;
  el.textContent=text; el.classList.remove("hidden","error");
  if(err)el.classList.add("error");
}

function loginView(){
  app.innerHTML = `
  <main class="loginShell"><section class="loginCard">
    <div class="brand">FROM BIRD <span>ADMIN</span></div>
    <p class="eyebrow">ADMINISTRATION</p>
    <h1>更新するための巣。</h1>
    <p class="muted">招待・登録済みの管理者だけがログインできます。</p>
    <form id="loginForm" class="stack">
      <label>メール<input id="email" type="email" autocomplete="email" required></label>
      <label>パスワード<input id="password" type="password" autocomplete="current-password" minlength="6" required></label>
      <button class="primary" type="submit">ログイン</button>
      <button class="textButton" id="forgot" type="button">パスワードを忘れた方</button>
    </form>
    <p id="authMessage" class="notice hidden"></p>
    <p class="securityNote">新規登録はこの画面からできません。新しい担当者を追加する場合は、管理者から招待します。</p>
  </section></main>`;

  document.querySelector("#loginForm").onsubmit=async e=>{
    e.preventDefault();
    const email=document.querySelector("#email").value.trim();
    const password=document.querySelector("#password").value;
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error)return authMessage("ログインできませんでした。メール・パスワードを確認してください。",true);
    if(!isAdmin(data.user)){
      await supabase.auth.signOut();
      return authMessage("このアカウントには管理権限がありません。",true);
    }
    state.user=data.user; await refresh(); render();
  };

  document.querySelector("#forgot").onclick=async ()=>{
    const email=document.querySelector("#email").value.trim();
    if(!email)return authMessage("先に登録メールアドレスを入力してください。",true);
    const redirectTo = `${window.location.origin}/admin/`;
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
    authMessage(error ? `再設定メールを送れませんでした：${error.message}` : "パスワード再設定メールを送りました。メール内のリンクを開いてください。", !!error);
  };
}

function recoveryView(){
  app.innerHTML = `
  <main class="loginShell"><section class="loginCard">
    <div class="brand">FROM BIRD <span>ADMIN</span></div>
    <p class="eyebrow">PASSWORD RECOVERY</p>
    <h1>新しいパスワード。</h1>
    <p class="muted">新しいパスワードを設定してください。</p>
    <form id="recoveryForm" class="stack">
      <label>新しいパスワード<input id="newPassword" type="password" autocomplete="new-password" minlength="8" required></label>
      <label>もう一度<input id="newPassword2" type="password" autocomplete="new-password" minlength="8" required></label>
      <button class="primary" type="submit">パスワードを更新</button>
    </form>
    <p id="authMessage" class="notice hidden"></p>
  </section></main>`;
  document.querySelector("#recoveryForm").onsubmit=async e=>{
    e.preventDefault();
    const a=document.querySelector("#newPassword").value;
    const b=document.querySelector("#newPassword2").value;
    if(a!==b)return authMessage("パスワードが一致していません。",true);
    const {error}=await supabase.auth.updateUser({password:a});
    if(error)return authMessage(`更新できませんでした：${error.message}`,true);
    state.recovery=false;
    authMessage("更新しました。ログイン画面に戻ります。");
    setTimeout(async()=>{await supabase.auth.signOut();state.user=null;render()},900);
  };
}

function shell(inner){
  return `<main class="adminShell">
    <aside class="sidebar">
      <div><div class="brand">FROM BIRD <span>ADMIN</span></div><p class="muted small">${esc(state.user?.email||"")}</p></div>
      <nav>
        <button data-tab="contents" class="${state.tab==="contents"?"active":""}">コンテンツ</button>
        <button data-tab="news" class="${state.tab==="news"?"active":""}">更新情報</button>
        <button data-tab="categories" class="${state.tab==="categories"?"active":""}">カテゴリ</button>
      </nav>
      <button class="ghost" id="logout">ログアウト</button>
    </aside>
    <section class="workspace">
      <header class="topbar">
        <div><p class="eyebrow">FROM BIRD / ADMIN</p><h1>${state.tab==="contents"?"コンテンツ管理":state.tab==="news"?"更新情報":"カテゴリ管理"}</h1></div>
        ${state.message?`<div class="notice ${state.isError?"error":""}">${esc(state.message)}</div>`:""}
      </header>
      ${inner}
    </section>
  </main>`;
}

function contentView(){
  const f=state.editingContent||{id:"",category_id:"",title:"",slug:"",description:"",url:"",thumbnail_path:"",status:"draft",is_featured:false,is_new:false,sort_order:0,published_at:null};
  return shell(`<div class="twoCol">
    <section class="panel"><div class="panelHead"><h2>一覧</h2><button class="ghost compact" id="newContent">＋ 新規</button></div>
      <div class="list">${state.contents.length?state.contents.map(x=>`<button class="listItem editContent" data-id="${x.id}"><div><strong>${esc(x.title)}</strong><span>${esc(catName(x.category_id))}</span></div><span class="status ${x.status}">${x.status==="published"?"公開":"下書き"}</span></button>`).join(""):`<p class="empty">まだコンテンツがありません。</p>`}</div>
    </section>
    <form class="panel editor" id="contentForm">
      <p class="eyebrow">${f.id?"EDIT":"NEW CONTENT"}</p><h2>${f.id?"コンテンツを編集":"新しいコンテンツ"}</h2>
      <label>タイトル<input name="title" value="${esc(f.title)}" required></label>
      <label>slug<input name="slug" value="${esc(f.slug)}" placeholder="gravity-lab" required></label>
      <label>カテゴリ<select name="category_id"><option value="">未分類</option>${state.categories.map(c=>`<option value="${c.id}" ${f.category_id===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>
      <label>説明<textarea name="description" rows="4">${esc(f.description||"")}</textarea></label>
      <label>URL<input name="url" type="url" value="${esc(f.url||"")}" placeholder="https://..."></label>
      <label>サムネイルパス<input name="thumbnail_path" value="${esc(f.thumbnail_path||"")}" placeholder="thumbs/gravity.jpg"></label>
      <div class="row"><label>状態<select name="status"><option value="draft" ${f.status==="draft"?"selected":""}>下書き</option><option value="published" ${f.status==="published"?"selected":""}>公開</option></select></label><label>表示順<input name="sort_order" type="number" value="${Number(f.sort_order||0)}"></label></div>
      <div class="checks"><label><input name="is_new" type="checkbox" ${f.is_new?"checked":""}> NEW</label><label><input name="is_featured" type="checkbox" ${f.is_featured?"checked":""}> おすすめ</label></div>
      <div class="actions"><button class="primary" type="submit">保存する</button>${f.id?`<button class="danger" id="deleteContent" type="button">削除</button>`:""}</div>
    </form>
  </div>`);
}

function newsView(){
  const f=state.editingNews||{id:"",title:"",body:"",link_url:"",image_path:"",status:"draft",published_at:null};
  return shell(`<div class="twoCol">
    <section class="panel"><div class="panelHead"><h2>更新履歴</h2><button class="ghost compact" id="newNews">＋ 新規</button></div>
      <div class="list">${state.news.length?state.news.map(x=>`<button class="listItem editNews" data-id="${x.id}"><div><strong>${esc(x.title)}</strong><span>${x.published_at?new Date(x.published_at).toLocaleDateString("ja-JP"):"未公開"}</span></div><span class="status ${x.status}">${x.status==="published"?"公開":"下書き"}</span></button>`).join(""):`<p class="empty">まだ更新情報がありません。</p>`}</div>
    </section>
    <form class="panel editor" id="newsForm">
      <p class="eyebrow">${f.id?"EDIT":"NEW UPDATE"}</p><h2>${f.id?"更新情報を編集":"新しい更新情報"}</h2>
      <label>タイトル<input name="title" value="${esc(f.title)}" required></label>
      <label>本文<textarea name="body" rows="8">${esc(f.body||"")}</textarea></label>
      <label>リンク<input name="link_url" type="url" value="${esc(f.link_url||"")}"></label>
      <label>画像パス<input name="image_path" value="${esc(f.image_path||"")}"></label>
      <label>状態<select name="status"><option value="draft" ${f.status==="draft"?"selected":""}>下書き</option><option value="published" ${f.status==="published"?"selected":""}>公開</option></select></label>
      <div class="actions"><button class="primary" type="submit">保存する</button>${f.id?`<button class="danger" id="deleteNews" type="button">削除</button>`:""}</div>
    </form>
  </div>`);
}

function categoryView(){
  const f=state.editingCategory||{id:"",name:"",slug:"",description:"",sort_order:(state.categories.length+1)*10,is_active:true};
  return shell(`<div class="twoCol">
    <section class="panel"><div class="panelHead"><h2>カテゴリ一覧</h2><button class="ghost compact" id="newCategory">＋ 新規</button></div>
      ${state.categories.map(c=>`<div class="categoryRow"><div><strong>${esc(c.name)}</strong><span>/${esc(c.slug)}</span></div><div class="actions"><span>${c.is_active?"使用中":"停止"}</span><button class="ghost compact editCategory" data-id="${c.id}">編集</button></div></div>`).join("")}
    </section>
    <form class="panel editor" id="categoryForm">
      <p class="eyebrow">${f.id?"EDIT CATEGORY":"NEW CATEGORY"}</p><h2>${f.id?"カテゴリを編集":"カテゴリを追加"}</h2>
      <label>名前<input name="name" value="${esc(f.name)}" required></label>
      <label>slug<input name="slug" value="${esc(f.slug)}" required></label>
      <label>説明<textarea name="description" rows="4">${esc(f.description||"")}</textarea></label>
      <div class="row"><label>表示順<input name="sort_order" type="number" value="${Number(f.sort_order||0)}"></label><label>状態<select name="is_active"><option value="true" ${f.is_active?"selected":""}>使用中</option><option value="false" ${!f.is_active?"selected":""}>停止</option></select></label></div>
      <div class="actions"><button class="primary" type="submit">${f.id?"更新する":"追加する"}</button>${f.id?`<button class="danger" id="deleteCategory" type="button">削除</button>`:""}</div>
    </form>
  </div>`);
}

async function doDelete(table,id,label){
  if(!confirm(`「${label}」を削除しますか？\\nこの操作は元に戻せません。`))return false;
  const {error}=await supabase.from(table).delete().eq("id",id);
  if(error){flash(`削除できませんでした：${error.message}`,true);return false}
  flash("削除しました。");
  await refresh(); return true;
}

async function render(){
  if(state.recovery)return recoveryView();
  if(!state.user)return loginView();
  if(!isAdmin(state.user)){await supabase.auth.signOut();state.user=null;return loginView()}

  app.innerHTML = state.tab==="contents"?contentView():state.tab==="news"?newsView():categoryView();

  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.message="";state.isError=false;render()});
  document.querySelector("#logout").onclick=async()=>{await supabase.auth.signOut();state.user=null;state.message="";render()};

  if(state.tab==="contents"){
    document.querySelector("#newContent").onclick=()=>{state.editingContent=null;render()};
    document.querySelectorAll(".editContent").forEach(b=>b.onclick=()=>{state.editingContent=state.contents.find(x=>x.id===b.dataset.id);render()});
    const form=document.querySelector("#contentForm");
    form.onsubmit=async e=>{
      e.preventDefault(); const d=new FormData(e.currentTarget); const status=d.get("status");
      const payload={category_id:d.get("category_id")||null,title:d.get("title"),slug:d.get("slug"),description:d.get("description")||null,url:d.get("url")||null,thumbnail_path:d.get("thumbnail_path")||null,status,is_featured:d.get("is_featured")==="on",is_new:d.get("is_new")==="on",sort_order:Number(d.get("sort_order")||0),published_at:status==="published"?(state.editingContent?.published_at||new Date().toISOString()):null};
      const q=state.editingContent?.id?supabase.from("contents").update(payload).eq("id",state.editingContent.id):supabase.from("contents").insert(payload);
      const {error}=await q; flash(error?`保存できませんでした：${error.message}`:"保存しました 🐦",!!error); if(!error){state.editingContent=null;await refresh()} render();
    };
    const del=document.querySelector("#deleteContent");
    if(del)del.onclick=async()=>{if(await doDelete("contents",state.editingContent.id,state.editingContent.title)){state.editingContent=null;render()}};
  }

  if(state.tab==="news"){
    document.querySelector("#newNews").onclick=()=>{state.editingNews=null;render()};
    document.querySelectorAll(".editNews").forEach(b=>b.onclick=()=>{state.editingNews=state.news.find(x=>x.id===b.dataset.id);render()});
    document.querySelector("#newsForm").onsubmit=async e=>{
      e.preventDefault(); const d=new FormData(e.currentTarget); const status=d.get("status");
      const payload={title:d.get("title"),body:d.get("body")||null,link_url:d.get("link_url")||null,image_path:d.get("image_path")||null,status,published_at:status==="published"?(state.editingNews?.published_at||new Date().toISOString()):null};
      const q=state.editingNews?.id?supabase.from("news").update(payload).eq("id",state.editingNews.id):supabase.from("news").insert(payload);
      const {error}=await q; flash(error?`保存できませんでした：${error.message}`:"更新情報を保存しました 🐦",!!error); if(!error){state.editingNews=null;await refresh()} render();
    };
    const del=document.querySelector("#deleteNews");
    if(del)del.onclick=async()=>{if(await doDelete("news",state.editingNews.id,state.editingNews.title)){state.editingNews=null;render()}};
  }

  if(state.tab==="categories"){
    document.querySelector("#newCategory").onclick=()=>{state.editingCategory=null;render()};
    document.querySelectorAll(".editCategory").forEach(b=>b.onclick=()=>{state.editingCategory=state.categories.find(x=>x.id===b.dataset.id);render()});
    document.querySelector("#categoryForm").onsubmit=async e=>{
      e.preventDefault(); const d=new FormData(e.currentTarget);
      const payload={name:d.get("name"),slug:d.get("slug"),description:d.get("description")||null,sort_order:Number(d.get("sort_order")||0),is_active:d.get("is_active")==="true"};
      const q=state.editingCategory?.id?supabase.from("categories").update(payload).eq("id",state.editingCategory.id):supabase.from("categories").insert(payload);
      const {error}=await q; flash(error?`保存できませんでした：${error.message}`:(state.editingCategory?"カテゴリを更新しました":"カテゴリを追加しました"),!!error); if(!error){state.editingCategory=null;await refresh()} render();
    };
    const del=document.querySelector("#deleteCategory");
    if(del)del.onclick=async()=>{if(await doDelete("categories",state.editingCategory.id,state.editingCategory.name)){state.editingCategory=null;render()}};
  }
}

const {data:{user}}=await supabase.auth.getUser();
state.user=user;
if(state.user && isAdmin(state.user))await refresh();
render();

supabase.auth.onAuthStateChange(async(event,session)=>{
  if(event==="PASSWORD_RECOVERY"){
    state.user=session?.user||null; state.recovery=true; render(); return;
  }
  state.user=session?.user||null;
  if(state.user && isAdmin(state.user))await refresh();
  render();
});
