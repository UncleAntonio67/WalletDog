// pages/index/index.js
import * as echarts from '../../ec-canvas/echarts';

const app = getApp();
const db = wx.cloud.database();

let chartInstance = null;

Page({
  data: {
    totalAsset: '0.00',
    totalDayProfit: '0.00',
    assetList: [],
    ec: { lazyLoad: true }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().init();
    }
    this.loadAssets();       
  },

  // ✨✨✨ 关键修复：安全的跳转方法 ✨✨✨
  goDetail(e) {
    const item = e.currentTarget.dataset.item;
    // 1. 转字符串
    const jsonStr = JSON.stringify(item);
    // 2. URL编码 (防止中文或特殊符号截断)
    const encodedStr = encodeURIComponent(jsonStr);
    
    wx.navigateTo({
      url: `/pages/detail/detail?assetStr=${encodedStr}`
    });
  },

  loadAssets() {
    wx.showLoading({ title: '刷新...' });
    db.collection('assets').get().then(res => {
      const assets = res.data;
      const codes = assets
        .filter(item => item.type !== '银行存款' && item.code)
        .map(item => item.code);

      if (codes.length > 0) {
        this.fetchRealTimeData(assets, codes);
      } else {
        this.processData(assets, {}); 
      }
    }).catch(err => {
      console.error(err);
      wx.hideLoading();
    });
  },

  fetchRealTimeData(assets, codes) {
    wx.cloud.callFunction({
      name: 'getFundData',
      data: { codes: codes }
    }).then(res => {
      const marketData = {};
      if (res.result && res.result.data) {
        res.result.data.forEach(item => {
          marketData[item.code] = {
            rate: parseFloat(item.gszzl || 0), 
            nav: parseFloat(item.gsz || item.dwjz || 0)
          };
        });
      }
      this.processData(assets, marketData);
    }).catch(err => {
      console.error('行情失败', err);
      this.processData(assets, {});
    });
  },

  processData(assets, marketData) {
    let total = 0;
    let dayProfitTotal = 0;
    let typeMap = { '银行存款': 0, '公募基金': 0, '股票/ETF': 0, '定期理财': 0, '其他': 0 };

    const processedList = assets.map(item => {
      let dailyProfit = 0;  
      let displayRate = 0;  
      let currentBalance = parseFloat(item.balance);

      if (item.type === '银行存款') {
        const rate = parseFloat(item.annualRate || 0);
        displayRate = rate; 
        dailyProfit = parseFloat(item.principal) * (rate / 100) / 365;
        currentBalance = parseFloat(item.principal); 
      } else {
        const market = marketData[item.code];
        if (market) {
          displayRate = market.rate; 
          dailyProfit = currentBalance * (market.rate / 100);
        } else {
          displayRate = 0;
        }
      }

      total += currentBalance;
      dayProfitTotal += dailyProfit;

      if (typeMap[item.type] !== undefined) typeMap[item.type] += currentBalance;
      else typeMap['其他'] += currentBalance;

      return {
        ...item,
        currentBalance: currentBalance.toFixed(2),
        displayRate: displayRate.toFixed(2),
        dailyProfit: dailyProfit.toFixed(2),
        isPositive: dailyProfit >= 0
      };
    });

    processedList.sort((a, b) => b.currentBalance - a.currentBalance);

    this.setData({
      assetList: processedList,
      totalAsset: total.toFixed(2),
      totalDayProfit: (dayProfitTotal > 0 ? '+' : '') + dayProfitTotal.toFixed(2)
    });

    wx.hideLoading();

    // 延迟初始化图表
    setTimeout(() => { this.initChart(typeMap); }, 500);
  },

  initChart(typeMap) {
    const chartData = Object.keys(typeMap).filter(key => typeMap[key] > 0).map(key => ({ name: key, value: typeMap[key].toFixed(2) }));
    if (chartData.length === 0) return;

    const ecComponent = this.selectComponent('#mychart-dom-pie');
    if (!ecComponent) return;

    const option = {
      color: ['#1A73E8', '#F0B90B', '#34A853', '#EA4335', '#909399'],
      tooltip: { trigger: 'item', formatter: '{b}\n{c} ({d}%)' },
      series: [{
        name: '资产分布', type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'],
        avoidLabelOverlap: false, label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: '14', fontWeight: 'bold' } },
        data: chartData
      }]
    };

    ecComponent.init((canvas, width, height, dpr) => {
      chartInstance = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
      chartInstance.setOption(option);
      return chartInstance;
    });
  }
});