# Публикация на GitHub Pages

1. На GitHub создайте пустой **публичный** репозиторий, например `zerno-i-ritm`. Оставьте опции добавления README, лицензии и `.gitignore` выключенными. Для этой схемы выберите обычное имя репозитория проекта, чтобы сайт открывался по адресу `https://ВАШ-ЛОГИН.github.io/ИМЯ-РЕПОЗИТОРИЯ/`. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages)
2. В PowerShell из корня проекта подставьте свой логин и имя репозитория и выполните команды.

   ```powershell
   $owner = 'ВАШ-ЛОГИН'
   $repo = 'zerno-i-ritm'
   git init -b main
   git add .
   git commit -m "Initial site and GitHub Pages deployment"
   git remote add origin "https://github.com/$owner/$repo.git"
   git push -u origin main
   ```

3. В репозитории откройте **Settings → Pages → Build and deployment** и выберите **GitHub Actions** в поле **Source**. Если первая публикация завершилась ошибкой до выбора источника, откройте **Actions → Deploy to GitHub Pages → Run workflow**, выберите `main` и запустите его вручную. [Настройка источника публикации](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
4. После успешного запуска откройте ссылку из задания `deploy` или раздела **Settings → Pages**. При следующих пушах в `main` GitHub Actions автоматически соберёт и опубликует `dist`.

GitHub Pages размещает статический сайт. На опубликованном сайте QR-оплата и возврат работают в песочнице. Для реальной оплаты через ЮKassa нужен отдельный сервер.
