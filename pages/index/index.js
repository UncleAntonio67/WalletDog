// pages/index/index.js
import * as echarts from '../../ec-canvas/echarts';

const app = getApp();
const db = wx.cloud.database();

let chartInstance = null;

Page({
  data: {
    totalAsset: '0.00',    // 总资产
    totalDayProfit: '0.00',// 昨日总收益
    assetList: [],         // 列表数据
    ec: {
      lazyLoad: true       // 延迟加载，必须为 true
    }
  },

  onShow() {
    // 1. 防崩溃检查
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().init();
    }
    
    // 2. 刷新数据
    this.loadAssets();       
  },

  // 加载数据库资产
  loadAssets() {
    wx.showLoading({ title: '刷新资产...' });
    
    db.collection('assets').get().then(res => {
      const assets = res.data;
      
      // 提取需要查行情的代码 (排除银行存款)
      const codes = assets
        .filter(item => item.type !== '银行存款' && item.code)
        .map(item => item.code);

      // 获取实时行情
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

  // 获取云端行情
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

  // 核心计算逻辑
  processData(assets, marketData) {
    let total = 0;
    let dayProfitTotal = 0;
    
    // 饼图数据统计
    let typeMap = { '银行存款': 0, '公募基金': 0, '股票/ETF': 0, '定期理财': 0, '其他': 0 };

    const processedList = assets.map(item => {
      let dailyProfit = 0;  
      let displayRate = 0;  
      let currentBalance = parseFloat(item.balance);

      // A. 存款计算
      if (item.type === '银行存款') {
        const rate = parseFloat(item.annualRate || 0);
        displayRate = rate; 
        // 日息 = 本金 * 年利率% / 365
        dailyProfit = parseFloat(item.principal) * (rate / 100) / 365;
        currentBalance = parseFloat(item.principal); 
      } 
      // B. 基金/股票计算
      else {
        const market = marketData[item.code];
        if (market) {
          displayRate = market.rate; 
          // 昨日盈亏 = 金额 * 涨跌幅%
          dailyProfit = currentBalance * (market.rate / 100);
        } else {
          displayRate = 0;
        }
      }

      total += currentBalance;
      dayProfitTotal += dailyProfit;

      // 累加分类
      if (typeMap[item.type] !== undefined) {
        typeMap[item.type] += currentBalance;
      } else {
        typeMap['其他'] += currentBalance;
      }

      return {
        ...item,
        currentBalance: currentBalance.toFixed(2),
        displayRate: displayRate.toFixed(2),
        dailyProfit: dailyProfit.toFixed(2),
        isPositive: dailyProfit >= 0
      };
    });

    // 按余额降序
    processedList.sort((a, b) => b.currentBalance - a.currentBalance);

    this.setData({
      assetList: processedList,
      totalAsset: total.toFixed(2),
      totalDayProfit: (dayProfitTotal > 0 ? '+' : '') + dayProfitTotal.toFixed(2)
    });

    wx.hideLoading();

    // ✨✨✨ 修复图表不显示的问题：加一点点延时，确保 DOM 准备好 ✨✨✨
    setTimeout(() => {
      this.initChart(typeMap);
    }, 200);
  },

  // 初始化/更新图表
  initChart(typeMap) {
    const chartData = Object.keys(typeMap)
      .filter(key => typeMap[key] > 0)
      .map(key => ({
        name: key,
        value: typeMap[key].toFixed(2)
      }));
    
    if (chartData.length === 0) return;

    const option = {
      // 经典的金融配色
      color: ['#1A73E8', '#F0B90B', '#34A853', '#EA4335', '#909399'],
      tooltip: { 
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)' // 显示百分比
      },
      legend: { 
        orient: 'vertical',
        right: '5%',
        top: 'center',
        itemWidth: 10, 
        itemHeight: 10 
      },
      series: [{
        name: '资产分布',
        type: 'pie',
        radius: ['45%', '70%'], // 环形大小
        center: ['35%', '50%'], // 把饼图稍微往左移，给图例留空间
        avoidLabelOverlap: false,
        label: { show: false, position: 'center' },
        emphasis: {
          label: { show: true, fontSize: '14', fontWeight: 'bold' }
        },
        data: chartData
      }]
    };

    const ecComponent = this.selectComponent('#mychart-dom-pie');
    
    if (!ecComponent) {
      console.warn('找不到图表组件');
      return;
    }

    if (!chartInstance) {
      ecComponent.init((canvas, width, height, dpr) => {
        chartInstance = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        chartInstance.setOption(option);
        return chartInstance;
      });
    } else {
      chartInstance.setOption(option);
    }
  }
});