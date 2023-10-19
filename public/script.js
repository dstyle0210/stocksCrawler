let rate = {};
let app;
const projectId = "dstyle-stocks";
firebase.initializeApp({ authDomain:`${projectId}.firebaseapp.com/`, databaseURL:`https://${projectId}-default-rtdb.firebaseio.com`, projectId:projectId });
$(async function(){
    const index = await new Promise((resolve,reject)=>{
        firebase.database().ref('/dailyIndex').on('value', snapshot => {
            const indexData = snapshot.val();
            resolve(indexData);
        });
    });
    console.log(index);

    const rate = await new Promise((resolve,reject)=>{
        firebase.database().ref('/dailyRate').on('value', snapshot => {
            const rateData = snapshot.val();
            rateData.spreadText = (rateData.spread * 100).toFixed(2);
            rateData.bond3yText = rateData.bondSpread3Y;
            rateData.dateText = rateData.date;
            resolve(rateData);
        });
    });
    const stocks = await new Promise((resolve,reject)=>{
        firebase.database().ref('/dailyStock').on('value', snapshot => {
            const _stocks = snapshot.val();            
            let rows = [];
            let tbody = "";
            for (key in _stocks) {
                rows.push(_stocks[key]);
            };
            rows.forEach((stock) => {
                stock.dividendPer = +((stock.dividend / stock.price) * 100).toFixed(2);// 배당률
                stock.roePer = (stock.roe * 100).toFixed(2);// ROE
                stock.rimPer = (stock.rim * 100).toFixed(2);// RIM
                stock.rightPrice = Math.floor(stock.cap / stock.stocks);// 적정주가
                stock.safetyMargin = (((stock.rightPrice - stock.price) / stock.price) * 100).toFixed(2);// 안전마진
            });
            rows.sort((a, b) => {
                return (+b.safetyMargin) - (+a.safetyMargin);
            });
            resolve(rows);
        });
    });

    stocks.forEach((stock,idx)=>{
        stock.roeClassName = stock.roe < rate.spread ? 'table-danger' :'table-success';
        const dividendPer = (stock.dividend / stock.price);
        stock.dividendClassName = (dividendPer < stock.roe) && ((rate.bondSpread3Y / 100) < dividendPer) ? 'table-success' :'table-danger';
        stock.safetyMarginClassName = 0 < stock.safetyMargin ? 'table-success' :'table-danger';
        stock.rimClassName = 0 < stock.rim ? 'table-success' :'table-danger';
        stock.foreignerClassName = 0 < stock.foreigner ? 'table-success' :'table-danger';
        stock.foreignerYClassName = 0 < stock.foreignerY ? "-red" : "-blue";
    });


    app = Vue.createApp({
        data() {
            return {
                index:index,
                rate:rate,
                stocks:stocks
            };
        }
    });

    app.mount('#app');
});