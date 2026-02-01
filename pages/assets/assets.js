// pages/assets/assets.js
import * as echarts from '../../ec-canvas/echarts';
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    currentType: 'all', 
    sortBy: 'balance',  
    chartMode: 'dist',  
    
    rawList: [],      
    displayList: [],  
    
    ec: { lazyLoad: true },
    chartOpacity: 1
  },

  chartInstance: null,

  onLoad(options) {
    // ✨✨✨ 核心：接收首页传来的参数，自动选中对应Tab ✨✨✨
    if (options.type) {
      this.setData({ currentType: options.type });
    }
  },

  onShow() {
    this.setData({ chartOpacity: 1 });
    this.loadAssets();
  },

  // 切换分类 Tab
  switchType(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.currentType) return;
    this.setData({ currentType: type, chartMode: 'dist' }, () => {
      this.filterAndSort();
      this.renderChart();
    });
  },

  // 切换排序
  switchSort(e) {
    const sort = e.currentTarget.dataset.sort;
    if (sort === this.data.sortBy) return;
    this.setData({ sortBy: sort }, () => {
      this.filterAndSort();
    });
  },

  // 切换图表维度
  switchChartMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.chartMode) return;
    this.setData({ chartMode: mode }, () => {
      this.renderChart();
    });
  },

  goDetail(e) {
    this.setData({ chartOpacity: 0 });
    const item = e.currentTarget.dataset.item;
    // 简单做个延时，防止闪烁
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/detail/detail?assetStr=${encodeURIComponent(JSON.stringify(item))}`
      });
    }, 50);
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

      return {
        ...item,
        currentBalanceNum: currentBalance, 
        displayRateNum: displayRate,       
        dailyProfitNum: dailyProfit,       
        
        currentBalance: currentBalance.toFixed(2),
        displayRate: displayRate.toFixed(2),
        dailyProfit: dailyProfit.toFixed(2)
      };
    });

    this.data.rawList = processedList;
    this.filterAndSort();
    wx.hideNavigationBarLoading();

    if (this.data.currentType !== 'all') {
       setTimeout(() => { this.renderChart(); }, 200);
    }
  },

  filterAndSort() {
    let list = [...this.data.rawList];

    if (this.data.currentType !== 'all') {
      list = list.filter(item => item.type === this.data.currentType);
    }

    const sortKeyMap = {
      'balance': 'currentBalanceNum',
      'rate': 'displayRateNum',
      'profit': 'dailyProfitNum'
    };
    const sortKey = sortKeyMap[this.data.sortBy];
    list.sort((a, b) => b[sortKey] - a[sortKey]);

    this.setData({ displayList: list });
  },

  renderChart() {
    if (this.data.currentType === 'all' || this.data.displayList.length === 0) return;

    const mode = this.data.chartMode;
    const list = this.data.displayList.slice(0, 5);
    
    let option = {};
    const colors = ['#1A73E8', '#42A5F5', '#66BB6A', '#FF7043', '#AB47BC'];

    if (mode === 'dist') {
      const data = list.map(item => ({ name: item.name, value: item.currentBalanceNum.toFixed(2) }));
      option = {
        animation: false, color: colors,
        tooltip: { trigger: 'item', formatter: '{b}\n{c} ({d}%)', confine: true },
        series: [{
          type: 'pie', radius: ['40%', '65%'], center: ['50%', '50%'],
          itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          data: data
        }]
      };
    } else {
      const valueKey = mode === 'rate' ? 'displayRateNum' : 'dailyProfitNum';
      const suffix = mode === 'rate' ? '%' : '元';
      
      const categories = list.map(item => item.name.length > 4 ? item.name.slice(0,4)+'..' : item.name);
      const values = list.map(item => item[valueKey].toFixed(2));

      option = {
        animation: false,
        tooltip: { trigger: 'axis', confine: true, formatter: '{b}: {c}' + suffix, axisPointer: { type: 'shadow' } },
        grid: { top: '10%', bottom: '5%', left: '5%', right: '5%', containLabel: true },
        xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#F0F0F0' } } },
        yAxis: { type: 'category', data: categories.reverse(), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { fontSize: 11, color: '#666' } },
        series: [{
          type: 'bar', barWidth: '40%', data: values.reverse(),
          itemStyle: {
            color: (params) => (mode==='profit' && params.value < 0) ? '#00B578' : '#1A73E8',
            borderRadius: [0, 4, 4, 0]
          },
          label: { show: true, position: 'right', formatter: '{c}'+suffix, fontSize: 10, color: '#999' }
        }]
      };
    }

    const ecComponent = this.selectComponent('#mychart-dom-cat');
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