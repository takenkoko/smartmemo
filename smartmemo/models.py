import uuid
import os 
from django.db import models
from django.contrib.auth.models import User

# Create your models here.

class Category(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class Tag(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        )
    name = models.CharField(max_length=50)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user","name"],
                name = "unique_user_tag",
            )
        ]

    def __str__(self):
        return self.name

#日本語ファイル名や特殊文字によるトラブル対策
def profile_icon_path(instance,filename):
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('profile_icons/',filename)


#プロフィール画像機能を追加
class Profile(models.Model):
    user = models.OneToOneField(User,on_delete=models.CASCADE,related_name='profile')
    icon = models.ImageField(upload_to='profile_icons/',blank=True, null=True)

    def __str__(self):
        return f"{self.user.username}のプロフィール"


#日付を追加
class Memo(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )

    title = models.CharField(max_length=100)
    content = models.TextField()

    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,  
    )

    tags = models.ManyToManyField(
        Tag,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)  # 作成日時
    updated_at = models.DateTimeField(auto_now=True)      # 更新日時

   

    def __str__(self):
        return self.title