# stocksCrawler
매일 재무제표 업데이트, html, javascript, node, playwright, firebase
- playwright 크롤링
- firebase DB , hosting 이용
- github action 으로 자동화 (평일 , 오전 9시)
- 작업완료시 텔레그램 쏴줌



## 콘솔
### firebase login을 위한 권한변경
```powershell
> Set-ExecutionPolicy RemoteSigned
```
### Git 등록 (github)
```console
> git config --global user.name dstyle0210
> git config --global user.email dstyle0210@gmail.com
```

### 필요모듈 설치
```console
> npm i -g firebase-tools
> npm i
```

### Firebase Deploy
```console
firebase login
firebase deploy
```