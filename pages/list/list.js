// pages/list/list.js
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

  chartInstance: null, // 保存图表实例

  onShow() {
    this.setData({ chartOpacity: 1 });
    
    if (app.globalData.targetAssetType) {
      const target = app.globalData.targetAssetType;
      // 切换类型时，旧的图表组件会被销毁，所以实例必须置空
      this.chartInstance = null; 
      this.setData({ currentType: target, chartMode: 'dist' }, () => {
        this.loadAssets();
      });
      app.globalData.targetAssetType = null;
    } else {
      this.loadAssets();
    }
  },
  
  onHide() {
    // 页面隐藏时，为了节省性能，也可以考虑 dispose，但这里主要控制透明度
    this.setData({ chartOpacity: 0 });
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.currentType) return;

    // ✨✨✨ 关键修复：切换Tab会导致wx:if变化，组件重建，必须销毁旧实例引用 ✨✨✨
    this.chartInstance = null; 

    this.setData({ currentType: type, chartMode: 'dist' }, () => {
      this.filterAndSort();
      // 数据筛选完后，尝试渲染
      this.tryRenderChart();
    });
  },

  switchSort(e) {
    const sort = e.currentTarget.dataset.sort;
    if (sort === this.data.sortBy) return;
    this.setData({ sortBy: sort }, () => {
      this.filterAndSort();
    });
  },

  switchChartMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.chartMode) return;
    this.setData({ chartMode: mode }, () => {
      this.tryRenderChart();
    });
  },

  goDetail(e) {
    this.setData({ chartOpacity: 0 });
    const item = e.currentTarget.dataset.item;
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/detail/detail?assetStr=${encodeURIComponent(JSON.stringify(item))}`
      });
    }, 50);
  },

  loadAssets() {
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
    
    // ✨✨✨ 关键修复：确保数据setData完成后，再去渲染图表 ✨✨✨
    this.filterAndSort(); 
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

    // 更新列表数据
    this.setData({ displayList: list }, () => {
      // ✨ setDate 回调：数据更新完毕
      if (this.data.currentType !== 'all') {
        // ✨ wx.nextTick：视图层渲染完毕（wx:if 变成了 true，节点由于存在了）
        wx.nextTick(() => {
           this.tryRenderChart();
        });
      }
    });
  },

  // 封装一个带重试的渲染函数
  tryRenderChart(retryCount = 0) {
    // 如果当前是全部，不需要画图
    if (this.data.currentType === 'all') return;

    const ecComponent = this.selectComponent('#mychart-dom-cat');
    
    // 如果组件还没获取到（可能视图还在渲染中），且重试次数少于3次，延迟重试
    if (!ecComponent) {
      if (retryCount < 3) {
        setTimeout(() => {
          this.tryRenderChart(retryCount + 1);
        }, 100); // 100ms 后重试
      } else {
        console.warn('图表组件获取失败，停止重试');
      }
      return;
    }

    this.renderChart(ecComponent);
  },

// pages/list/list.js

// pages/list/list.js

// ... 其他代码 ...

renderChart(ecComponent) {
  const mode = this.data.chartMode;
  const list = this.data.displayList.slice(0, 5);

  if (list.length === 0) {
    if (this.chartInstance) { this.chartInstance.clear(); }
    return;
  }

  let option = {};
  // 使用相同的现代配色
  const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'];
  const profitColors = (value) => value >= 0 ? '#F5222D' : '#00B578';

  const commonTooltip = {
    trigger: mode === 'dist' ? 'item' : 'axis',
    confine: true,
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
    borderColor: '#333',
    textStyle: { color: '#fff', fontSize: 12 },
    padding: [8, 12],
    extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.2); border-radius: 6px;'
  };

  if (mode === 'dist') {
    // --- 1. 分布饼图 (解决重叠版) ---
    const data = list.map(item => ({ name: item.name, value: item.currentBalanceNum.toFixed(2) }));

    option = {
      color: colors,
      // 【关键优化】隐藏底部图例，彻底解决和标签打架的问题
      legend: { show: false },
      tooltip: { ...commonTooltip, formatter: '{b}<br/>¥{c} ({d}%)' },
      series: [{
        type: 'pie',
        // 调整半径和中心，留出足够空间给外部标签
        radius: ['35%', '60%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true, // 开启 ECharts 自动防重叠计算
        minAngle: 5, // 最小角度，防止数据太小导致标签挤在一起
        itemStyle: {
          borderRadius: 6, // 圆角
          borderColor: '#fff', // 描边
          borderWidth: 2
        },
        // 【关键优化】使用外部引导线标签
        label: {
          show: true,
          position: 'outside',
          color: '#555',
          fontSize: 11,
          lineHeight: 16,
          // 【关键优化】智能名称截断：超过5个字用省略号，第二行显示百分比
          formatter: function(params) {
            let name = params.name;
            if (name.length > 5) {
              name = name.slice(0, 5) + '..';
            }
            // 使用富文本样式突出百分比
            return `${name}\n{percent|${params.percent}%}`;
          },
          rich: {
            percent: {
              color: '#1A73E8', // 百分比用主题色高亮
              fontWeight: 'bold',
              fontSize: 12
            }
          }
        },
        // 引导线样式优化
        labelLine: {
          show: true,
          length: 15, // 第一段长度
          length2: 10, // 第二段长度
          smooth: true, // 平滑曲线
          lineStyle: { color: '#ccc', width: 1 }
        },
        data: data
      }]
    };
  } else {
    // --- 2. 柱状图 (榜单优化) ---
    const valueKey = mode === 'rate' ? 'displayRateNum' : 'dailyProfitNum';
    const suffix = mode === 'rate' ? '%' : '元';
    // 截断过长的 Y 轴名称
    const categories = list.map(item => item.name.length > 6 ? item.name.slice(0, 6) + '..' : item.name);
    const values = list.map(item => item[valueKey].toFixed(2));

    option = {
      tooltip: { ...commonTooltip, formatter: '{b}: {c}' + suffix, axisPointer: { type: 'shadow' } },
      // 调整边距确保标签不被截断
      grid: { top: '5%', bottom: '5%', left: '2%', right: '12%', containLabel: true },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { type: 'dashed', color: '#E0E6F1' } },
        axisLabel: { color: '#888', fontSize: 10 }
      },
      yAxis: {
        type: 'category',
        data: categories.reverse(),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { fontSize: 12, color: '#555', margin: 12, fontWeight: '500' }
      },
      series: [{
        type: 'bar',
        barWidth: '45%', // 适中宽度
        data: values.reverse(),
        itemStyle: {
          color: (params) => profitColors(params.value),
          borderRadius: [0, 6, 6, 0] // 右侧圆角
        },
        // 在柱子右侧显示数值
        label: {
          show: true,
          position: 'right',
          formatter: (params) => params.value > 0 ? `+${params.value}${suffix}` : `${params.value}${suffix}`,
          fontSize: 11,
          fontWeight: 'bold',
          color: (params) => profitColors(params.value),
          offset: [5, 0]
        }
      }]
    };
  }

  // ... 初始化代码保持不变 ...
  if (!this.chartInstance) {
    ecComponent.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
      chart.setOption(option);
      this.chartInstance = chart;
      return chart;
    });
  } else {
    this.chartInstance.clear();
    this.chartInstance.setOption(option);
  }
}
});