from django.shortcuts import render,redirect
from .models import Memo, Category, Tag
from django.db.models import Q
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout

from .forms import RegisterForm,ProfileEditForm,ProfileImageForm  #ユーザー登録機能 #アイコン追加
from .models import Profile
from django.shortcuts import render,redirect
from django.core.paginator import Paginator #ページネーションを追加

import markdown
import bleach

ALLOWED_TAGS = ['p','strong','em','h1','h2','h3','h4','ul','ol','li','blockquote','pre','code','a','br']
ALLOWED_ATTRIBUTES = {'a':['href'],
                      'code':['class'],
                      }

# Create your views here.
#Markdown交換とHTMLサニタイズを行う関数を作成
def render_memo_content(memo):
    html = markdown.markdown(memo,extensions=['fenced_code'])
    return bleach.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES)

@login_required
def index(request):
    memos=Memo.objects.filter(user=request.user)

    #ここにページネーション機能を追加します
    paginator = Paginator(memos,10)
    page_number = request.GET.get("page")
    page_obj = paginator.get_page(page_number)

    for memo in page_obj:
        memo.content_html = render_memo_content(memo.content)
        
    return render(request,"smartmemo/index.html",{
        "memos":page_obj,
    })

#========================
#詳細画面を作成する
#========================
@login_required
def detail(request,memo_id):
    memo = Memo.objects.get(id=memo_id, user=request.user)
    memo.content_html = render_memo_content(memo.content)

    return render(request,"smartmemo/detail.html",{
        "memo":memo,
    })

#============
#フォーム作成
#============
@login_required
def create(request):
    if request.method=="POST":
        
        title=request.POST.get("title", "").strip()
        content=request.POST["content"]
        category_id = request.POST.get("category")
        tag_names = request.POST.get("tags","")

        #titleが空欄の場合、エラーと返す
        if not title:
            return render(request,"smartmemo/create.html",{
                "error":"タイトルは必須です。",
                "categories":Category.objects.all()
            })


        category = None
        if category_id:
            category = Category.objects.get(id=category_id)

        memo = Memo.objects.create(
            user=request.user,
            title=title,
            content=content,
            category=category
        )
        if tag_names:
            tag_list = [tag.strip() for tag in tag_names.split(",") if tag.strip()]

            #tag_listをTagオブジェクトにしてメモに紐付ける
            for tag_name in tag_list:
                tag, create = Tag.objects.get_or_create(name=tag_name)
                memo.tags.add(tag)

        return redirect("index")
    return render(request,
                  "smartmemo/create.html",
                  {
                      "categories":Category.objects.all()
                  }
                  )

#==============
#編集機能を作成
#==============
@login_required
def edit(request,memo_id):
    memo = Memo.objects.get(id=memo_id, user=request.user,)

    #更新処理を作成
    if request.method=="POST":
        
        memo.title=request.POST["title"]
        memo.content=request.POST["content"]

        category_id = request.POST.get("category")

        tag_names = request.POST.get("tags","")

        if category_id :
            memo.category = Category.objects.get(id=category_id)
        else:
            memo.category = None

        memo.tags.clear()

        if tag_names:
            tag_list = [tag.strip() for tag in tag_names.split(",") if tag.strip()]

            for tag_name in tag_list:
                tag, created = Tag.objects.get_or_create(name=tag_name)
                memo.tags.add(tag)

        memo.save()

        return redirect("index")

    return render(request,"smartmemo/edit.html",{
        "memo":memo,
        "categories":Category.objects.all(),
    })

#=============
#削除機能を作成
#=============
@login_required
def delete(request,memo_id):
    memo=Memo.objects.get(id=memo_id, user=request.user,)

    memo.delete()
    
    return redirect("index")

#==============
#検索機能を作成
#==============
@login_required
def search(request):
    keyword = request.GET.get("keyword","")
    
    #ログインユーザーのメモだけ検索する
    memos= Memo.objects.filter(
        user=request.user
        ).filter(
            Q(title__icontains=keyword)|
            Q(content__icontains=keyword)

        )

    #検索結果にもページネーションを追加する
    paginator = Paginator(memos,10)
    page_number = request.GET.get("page")
    page_obj = paginator.get_page(page_number)

    return render(
        request,
        "smartmemo/index.html",
        {
            "memos":page_obj,
            "keyword":keyword,
        }
    )

#=====================================================
#カテゴリをクリックすると、そのカテゴリのメモだけを表示する
#=====================================================
@login_required
def category(request,category_id):
    category = Category.objects.get(id=category_id)
    #ログインユーザーのメモだけ、そのカテゴリを表示する
    memos = Memo.objects.filter(user=request.user,category=category)

    return render(
        request,
        "smartmemo/index.html",
        {
            "memos":memos,
            "selected_category":category,
        }
    )

#===============
#ユーザー登録機能
#===============
def register(request):

    if request.method == "POST":
        form = RegisterForm(request.POST)

        #入力された値が正しいか、文字数と未入力がないか。従っているかを調べる
        if form.is_valid():
            form.save() # 認証が済んだ安全なデータをＤＢに新しく書き込む。

            return redirect("login")
        
    else:
        form = RegisterForm()

    return render(
        request,
        "smartmemo/register.html",
        {
            "form": form,
        }
    )

#===================
#プロフィール画面機能
#===================
@login_required
def profile(request):
    return render(
        request,
        "smartmemo/profile.html",
        {
            "user":request.user,
        }
    )

#===================
#プロフィール編集機能
#===================
@login_required
def profile_edit(request):
    if request.method == "POST":
        form = ProfileEditForm(request.POST,instance=request.user)
        if form.is_valid():
            form.save()
            return redirect("profile")
    else:
        form = ProfileEditForm(instance=request.user)

    return render(request,"smartmemo/profile_edit.html", {"form": form})

#=================
#アカウント退会機能
#=================
@login_required
def account_delete(request):
    if request.method == "POST":
        password = request.POST.get("password")
        user = request.user

        if user.check_password(password):
            #ユーザーのメモをすべて削除
            Memo.objects.filter(user=user).delete()

            #ユーザー自身を削除
            logout(request)
            user.delete()

            return redirect("login")
        else:
            return render(request, "smartmemo/account_delete.html",{
                "error":"パスワードが正しくありません。"
            })
        
    return render(request,"smartmemo/account_delete.html")

#======================
#プロフィールアイコン機能
#======================
@login_required
def profile_edit(request):
    profile, create = Profile.objects.get_or_create(user=request.user)

    if request.method == "POST":
        form = ProfileEditForm(request.POST,instance=request.user)
        imge_form = ProfileImageForm(request.POST, request.FILES, instance=request.user.profile)

        if form.is_valid() and imge_form.is_valid():
            form.save()
            imge_form.save()
            return redirect("profile")
    else:
        form = ProfileEditForm(instance=request.user)
        imge_form = ProfileImageForm(instance=request.user.profile)

    return render(request,"smartmemo/profile_edit.html",{
        "form":form,
        "imge_form":imge_form,
    })