const fs = require("fs");
const {chromium,devices} = require("playwright");
const TelegramBot = require('node-telegram-bot-api');
const {initializeApp} = require('firebase/app');
const { getDatabase , set , ref ,onValue, goOffline } = require('firebase/database');

const token = '6168835435:AAEX-jYqum2mD4N2ath6_QihrqjPC5GJ-C4';
const chatId = 6252259316;
var rimResult = [];
var spread = 0;
var bondSpread3Y = 0;
var browser,page;
(async () => {

    var codeList = fs.readFileSync("./stocksCodeList.txt");
    codeList = codeList.toString().split("\r\n");
    const browser = await chromium.launch({headless:true});
    /*
    browser = await chromium.launch({
        headless:true,
        executablePath:"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" 
    });
    */
    page = await browser.newPage();

    
    // 기대수익률 구해오기
    await page.goto("https://www.kisrating.com/ratingsStatistics/statics_spread.do");
    let spreads = await page.evaluate(()=>{
        const toNum = (element) => +element.innerText.replace(/[\n\s\t\,]/gi,"");
        return {
            spread:(toNum( $(".table_ty1 table:eq(0) tr:last td:last").get(0) )/100).toFixed(4), // 계산을 위해 소수점으로 표시
            bondSpread3Y:toNum( $(".table_ty1 table:eq(0) tr:eq(1) td:eq(7)").get(0) ) // 표시만 있어서 그대로 받음.
        };
    });
    spread = spreads.spread;
    bondSpread3Y = spreads.bondSpread3Y;
    console.log(`기대수익률:${spread} , 3년 국고채 이율:${bondSpread3Y}`);

    const firebaseConfig = {
        databaseURL: "https://dstyle-stocks-default-rtdb.firebaseio.com",
    };
    const app = initializeApp(firebaseConfig);

    
    const db = getDatabase(app);

    var count = 1;
    for await(let code of codeList){
        console.log(`${count++} / ${codeList.length}`);
        const stockData = await getDataRIM(code);
        const dbRef = ref(db, `dailyStock/${stockData.code}`);
        await set(dbRef, stockData);
    };
    goOffline(db);

    fs.writeFileSync("./local/stocksData.js","var data="+JSON.stringify(rimResult),"utf8");
    
    // 텔레그램봇 시작
    const bot = new TelegramBot(token, {polling: false});
    bot.sendMessage(chatId, `[STOCK] 파일생성 완료\n기대수익률:${(spread*100).toFixed(2)}%\n국고채3년:${bondSpread3Y}%\n기준금리:3.50%`);

    await browser.close();
})();



function getDataRIM(stockCode){
    return new Promise(async function(resolve,reject){
        await page.goto("https://navercomp.wisereport.co.kr/v2/company/c1010001.aspx?cmp_cd="+stockCode);
        var reportData = await page.evaluate(async function(){
            
            $("#cns_Tab22").click(); // 분기탭으로 변경

            const toNum = ($element) => +$element.text().replace(/[\n\s\t\,]/gi,"");
            const $ifrs = $("table").eq(12);
            const $ifrsRows = $ifrs.find("tr");
            const price = toNum($(document.querySelector("#cTB11 .num strong")));
            
            // 예상 지배주주 순이익 구하기
            let profit = (() => {
                const values = $ifrsRows.eq(7).find("td");
                const isConsensus = toNum(values.eq(5)); // 컨센이 없다면, 0 이 떨어짐.
                const range = (isConsensus) ? values.slice(2,6) : values.slice(1,5);
                const sum = range.toArray().reduce((accValue,current)=>{
                    let v = current.innerText.replace(/[\,\s]/gi,"");
                    return accValue+(+v);
                },0);
                const test = range.toArray().map((current)=>{
                    return current.innerText.replace(/[\,\s]/gi,"");
                },0);
                return sum*100000000; // 억원
            })();

            // 최근 지배주주 지분 구하기(마지막 공시)
            let equity = (() => {
                const values = $ifrsRows.eq(12).find("td");
                return toNum(values.eq(4))*100000000; // 억원
            })();

            // 예상 배당금 구하기
            let dividend = (() => {
                const values = $ifrsRows.eq(31).find("td");
                const isConsensus = toNum(values.eq(5)); // 컨센이 없다면, 0 이 떨어짐.
                const range = (isConsensus) ? values.slice(2,6) : values.slice(1,5);
                const sum = range.toArray().reduce((accValue,current)=>{
                    let v = current.innerText.replace(/[\,\s]/gi,"");
                    return accValue+(+v);
                },0);
                const test = range.toArray().map((current)=>{
                    return current.innerText.replace(/[\,\s]/gi,"");
                },0);
                return sum; // 억원
            })();

            return {
                price,
                profit,
                equity,
                dividend
            };
        });


        // 네이버
        await page.goto("https://finance.naver.com/item/main.naver?code="+stockCode);
        var naverData = await page.evaluate(async function(){
            const toNum = (element) => +element.innerText.replace(/[\n\s\t\,]/gi,"");
            const name = document.querySelector(".wrap_company h2").innerText;
            const stocks = toNum( document.querySelector("#tab_con1").getElementsByTagName("em")[2] );

            // 외인수급확인
            const foreignerTable = document.getElementsByTagName("table")[2];
            const foreignerRows = [...foreignerTable.getElementsByTagName("tr")].slice(2,8);
            foreigner = foreignerRows.reduce((accValue,current) => {
                let v = current.getElementsByTagName("td")[2].innerText.replace(/[\,\s]/gi,"")*1;
                return accValue+(+v);
            },0);

            return {name,stocks,foreigner}
        });

        

        // 현재 지배주주 ROE 구하기
        var data = Object.assign({
            code:stockCode, // 종목코드 저장
        },naverData,reportData);
        data.profit = reportData.profit - (naverData.stocks*reportData.dividend), // 순이익(배당금을 뺀)
        data.roe = +((data.profit/data.equity).toFixed(4));
        data.rim = +((data.roe - spread)/spread).toFixed(4); // RIM 구하기
        data.cap = Math.floor( data.equity + (data.equity*data.rim) ); // 적정주가

        console.log(`${data.name} : ${data.price}`);

        // console.log(data);
        rimResult.push(data);

        await new Promise((res)=>{ setTimeout(res,1000); });
        resolve(data);
    })
}