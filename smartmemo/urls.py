from django.urls import path
from django.urls import reverse_lazy
from django.contrib.auth import views as auth_views
from .forms import RegisterForm, ProfileEditForm, CustomPasswordChangeForm, CustomPasswordResetForm, CustomSetPasswordForm
from . import views

urlpatterns=[

    path("",views.index,name='index'),

    path("create/",views.create,name="create"),

    path("edit/<int:memo_id>/",views.edit,name="edit"),

    path("delete/<int:memo_id>/",views.delete,name="delete"),

    path("search/",views.search,name="search"),

    path("category/<int:category_id>/",views.category,name="category",),

    path("tag/<int:tag_id>/",views.tag,name="tag"),

    path("register/", views.register, name="register"),

    path("profile/",views.profile, name="profile"),

    path("profile/edit/",views.profile_edit,name="profile_edit"),

    path("password_change/", auth_views.PasswordChangeView.as_view(
        template_name="smartmemo/password_change.html",
        form_class=CustomPasswordChangeForm,
        success_url="/password_change/done/",
        ),name="password_change",),

    path("password_change/done/",
         auth_views.PasswordChangeDoneView.as_view(
             template_name="smartmemo/password_change_done.html",
         ),
         name="password_change_done",
         ),
    path("account/delete/",views.account_delete, name="account_delete"),

    #メールアドレスを入力する画面
    path("password_reset/",auth_views.PasswordResetView.as_view(
        template_name="smartmemo/password_reset.html",
        form_class=CustomPasswordResetForm,
        email_template_name="smartmemo/password_reset_email.html",
        subject_template_name="smartmemo/password_reset_subject.txt",
        success_url=reverse_lazy("password_reset_done"),
    ),name="password_reset",),

    #「メールを送信しました」という案内画面
    path("password_reset/done/",auth_views.PasswordResetDoneView.as_view(
        template_name="smartmemo/password_reset_done.html",
    ),name="password_reset_done",),

    #メール内のリンクを踏んだ先、新しいパスワードを入力する画面
    path("reset/<uidb64>/<token>/",auth_views.PasswordResetConfirmView.as_view(
        template_name="smartmemo/password_reset_confirm.html",
        form_class=CustomSetPasswordForm,
        success_url=reverse_lazy("password_reset_complete"),
    ),name="password_reset_confirm",),

    #パスワード変更完了画面
    path("reset/done/",auth_views.PasswordResetCompleteView.as_view(
        template_name="smartmemo/password_reset_complete.html",
    ),name="password_reset_complete",),

    #詳細画面を追加する
    path("memo/<int:memo_id>/",views.detail,name="detail"),

]