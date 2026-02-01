// pages/index/index.js
import * as echarts from '../../ec-canvas/echarts';

const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    totalAsset: '0.00',
    totalDayProfit: '0.00',
    top5List: [], 
    categorySummary: {
      '银行存款': { balance: '0.00', profit: '0.00' },
      '公募基金': { balance: '0.00', profit: '0.00' },
      '股票/ETF': { balance: '0.00', profit: '0.00' },
      '定期理财': { balance: '0.00', profit: '0.00' }
    },
    chartType: 'pie', 
    ec: { lazyLoad: true },
    chartOpacity: 1 
  },

  chartInstance: null,
  cachedTypeMap: null,   
  cachedProfitMap: null, 

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().init();
    }
    this.setData({ chartOpacity: 1 });
    this.loadAssets();       
  },

  // ✨✨✨ 核心逻辑：带参跳转到 Tab 页 ✨✨✨
  goAssetsPage(e) {
    // 防止图表掉落
    this.setData({ chartOpacity: 0 });
    
    // 获取用户点击的类型，如果是点“查看全部”，则为 'all'
    const type = e.currentTarget.dataset.type || 'all';
    
    // 1. 设置全局变量，告诉列表页用户想看什么
    app.globalData.targetAssetType = type;
    
    // 2. 切换 Tab (跳转到 list 页面)
    setTimeout(() => {
       wx.switchTab({
         url: '/pages/list/list'
       });
    }, 100);
  },

  // ... 以下保持原有代码不变 ...
  switchChart(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.chartType) return;
    this.setData({ chartType: type });
    if (this.cachedTypeMap && this.cachedProfitMap) {
      this.renderChart();
    }
  },

  goDetail(e) {
    this.setData({ chartOpacity: 0 });
    const item = e.currentTarget.dataset.item;
    const jsonStr = JSON.stringify(item);
    const encodedStr = encodeURIComponent(jsonStr);
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/detail/detail?assetStr=${encodedStr}`
      });
    }, 100);
  },

  loadAssets() {
    wx.showNavigationBarLoading();
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
      wx.hideNavigationBarLoading();
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
    let profitMap = { '银行存款': 0, '公募基金': 0, '股票/ETF': 0, '定期理财': 0, '其他': 0 };
    
    let catSummaryRaw = {
      '银行存款': { balance: 0, profit: 0 },
      '公募基金': { balance: 0, profit: 0 },
      '股票/ETF': { balance: 0, profit: 0 },
      '定期理财': { balance: 0, profit: 0 },
      '其他': { balance: 0, profit: 0 }
    };

    const processedList = assets.map(item => {
      let dailyProfit = 0;  
      let displayRate = 0;  
      let currentBalance = parseFloat(item.balance);
      let principal = parseFloat(item.principal || 0);
      let totalProfit = currentBalance - principal;

      if (item.type === '银行存款') {
        const rate = parseFloat(item.annualRate || 0);
        displayRate = rate; 
        dailyProfit = parseFloat(item.principal) * (rate / 100) / 365;
        currentBalance = parseFloat(item.principal); 
        if (item.buyDate) {
          const start = new Date(item.buyDate.replace(/-/g, '/'));
          const now = new Date();
          const diffDays = Math.ceil(Math.abs(now - start) / (1000 * 60 * 60 * 24)); 
          totalProfit = dailyProfit * diffDays;
        } else {
          totalProfit = 0;
        }
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

      const typeKey = typeMap[item.type] !== undefined ? item.type : '其他';
      typeMap[typeKey] += currentBalance;
      profitMap[typeKey] += totalProfit;

      if (catSummaryRaw[typeKey]) {
        catSummaryRaw[typeKey].balance += currentBalance;
        catSummaryRaw[typeKey].profit += dailyProfit;
      }

      return {
        ...item,
        currentBalance: currentBalance.toFixed(2),
        displayRate: displayRate.toFixed(2), 
        dailyProfit: dailyProfit.toFixed(2),
        isPositive: dailyProfit >= 0
      };
    });

    const sortedByRate = [...processedList].sort((a, b) => parseFloat(b.displayRate) - parseFloat(a.displayRate));
    const top5List = sortedByRate.slice(0, 5);

    const finalCategorySummary = {};
    for (let key in catSummaryRaw) {
      finalCategorySummary[key] = {
        balance: catSummaryRaw[key].balance.toFixed(2),
        profit: catSummaryRaw[key].profit.toFixed(2)
      };
    }

    this.setData({
      top5List: top5List, 
      categorySummary: finalCategorySummary,
      totalAsset: total.toFixed(2),
      totalDayProfit: (dayProfitTotal > 0 ? '+' : '') + dayProfitTotal.toFixed(2)
    });

    this.cachedTypeMap = typeMap;
    this.cachedProfitMap = profitMap;

    wx.hideNavigationBarLoading();

    if (this.chartInstance) {
      this.renderChart();
    } else {
      setTimeout(() => {
        this.renderChart();
      }, 200);
    }
  },

// pages/index/index.js

// ... 前面的代码保持不变 ...

// pages/index/index.js

// ... 其他代码 ...

renderChart() {
  const type = this.data.chartType;
  let option = {};

  // 【优化1】全新专业配色：更沉稳、现代的金融色盘
  const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'];
  // 如果你喜欢经典的红绿配色用于涨跌，保留下面这行；否则上面的配色更现代用于分布。
  const profitColors = (value) => value >= 0 ? '#F5222D' : '#00B578'; // 涨红跌绿

  // 【优化2】通用的深色 Tooltip 样式，更显专业
  const commonTooltip = {
    trigger: type === 'pie' ? 'item' : 'axis',
    confine: true, // 将 tooltip 限制在图表区域内
    backgroundColor: 'rgba(50, 50, 50, 0.9)', // 深色背景
    borderColor: '#333',
    textStyle: { color: '#fff', fontSize: 12 },
    padding: [8, 12],
    extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.2); border-radius: 6px;'
  };

  if (type === 'pie') {
    // --- 首页饼图：简洁大气风格 ---
    const data = Object.keys(this.cachedTypeMap)
      .filter(key => this.cachedTypeMap[key] > 0)
      .map(key => ({ name: key, value: this.cachedTypeMap[key].toFixed(2) }));

    option = {
      color: colors,
      tooltip: { ...commonTooltip, formatter: '{b}<br/>¥{c} ({d}%)' },
      // 首页保留底部图例，展示概览
      legend: {
        show: true,
        bottom: '0%',
        left: 'center',
        icon: 'circle', // 圆形图标更柔和
        itemGap: 15,
        textStyle: { color: '#666', fontSize: 11 }
      },
      series: [{
        type: 'pie',
        // 【优化3】调整半径，让环更细致，中心空间更大
        radius: ['45%', '68%'],
        center: ['50%', '45%'], // 稍微上移，给图例留空间
        avoidLabelOverlap: true, // 防止标签重叠
        itemStyle: {
          borderRadius: 8, // 【优化4】扇区圆角
          borderColor: '#fff', // 【优化5】白色描边分隔
          borderWidth: 3
        },
        // 中心标签：强调总资产
        label: {
          show: true,
          position: 'center',
          formatter: () => '总资产', // 可以修改这里显示具体总金额
          fontSize: 14,
          color: '#999',
          fontWeight: 'normal'
        },
        // 高亮时显示详情
        emphasis: {
          label: {
            show: true,
            fontSize: 18,
            fontWeight: 'bold',
            color: '#333',
            formatter: '{b}\n{d}%'
          },
          scaleSize: 8
        },
        // 首页为了简洁，隐藏外部引导线标签，依赖图例和中心交互
        labelLine: { show: false },
        data: data
      }]
    };

  } else {
    // --- 首页柱状图：盈亏贡献 ---
    const categories = Object.keys(this.cachedProfitMap).filter(k => Math.abs(this.cachedProfitMap[k]) > 0);
    const values = categories.map(k => this.cachedProfitMap[k].toFixed(2));

    option = {
      tooltip: { ...commonTooltip, formatter: '{b}: {c}元', axisPointer: { type: 'shadow' } },
      grid: { top: '15%', bottom: '5%', left: '3%', right: '5%', containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { interval: 0, fontSize: 11, color: '#888', margin: 10 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#E0E6F1' } } // 更淡的轴线
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#888', fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed', color: '#E0E6F1' } } // 虚线网格
      },
      series: [{
        type: 'bar',
        barWidth: '35%', // 柱子稍微细一点
        data: values,
        itemStyle: {
          // 【优化6】动态红绿配色 + 顶部圆角
          color: (params) => profitColors(params.value),
          borderRadius: [6, 6, 0, 0]
        },
        // 在柱子上方显示数值
        label: {
          show: true,
          position: 'top',
          formatter: (params) => params.value > 0 ? `+${params.value}` : params.value,
          color: (params) => profitColors(params.value),
          fontSize: 11,
          fontWeight: 'bold'
        }
      }]
    };
  }

  // ... 初始化图表的代码保持不变 ...
  const ecComponent = this.selectComponent('#mychart-dom-pie');
  if (!ecComponent) return;
  if (!this.chartInstance) {
    ecComponent.init((canvas, width, height, dpr) => {
      this.chartInstance = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
      this.chartInstance.setOption(option);
      return this.chartInstance;
    });
  } else {
    this.chartInstance.clear();
    this.chartInstance.setOption(option);
  }
}
});