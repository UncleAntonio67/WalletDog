// pages/detail/detail.js
import * as echarts from '../../ec-canvas/echarts';

let chart = null;

Page({
  data: {
    asset: {},
    
    // 收益数据
    fixedProfit: 0, // 累计盈亏金额
    totalRate: 0,   // 累计收益率
    
    // 基金专用数据
    costPrice: 0,   // 持仓成本价
    
    // 图表数据
    ec: { lazyLoad: true },
    currentRange: '1m', 
    allHistory: []      
  },

  onLoad(options) {
    if (options.assetStr) {
      const asset = JSON.parse(decodeURIComponent(options.assetStr));
      
      // 1. 基础计算：累计盈亏 (余额 - 本金)
      const profit = parseFloat(asset.balance) - parseFloat(asset.principal);
      
      // 2. 基础计算：累计收益率 (盈亏 / 本金 * 100)
      let rate = 0;
      if (asset.principal > 0) {
        rate = (profit / asset.principal) * 100;
      }

      // 3. 基金专属计算：持仓成本价 (本金 / 份额)
      let cost = 0;
      if (asset.type !== '银行存款' && asset.shares > 0) {
        cost = asset.principal / asset.shares;
      }

      // 4. 设置数据，并在渲染完成后初始化图表
      this.setData({
        asset: asset,
        fixedProfit: profit.toFixed(2),
        totalRate: rate.toFixed(2),
        costPrice: cost.toFixed(4)
      }, () => {
        // 只有非存款类才有图表
        if (asset.type !== '银行存款' && asset.code) {
          // 延迟 200ms 确保页面渲染完成，防止找不到组件报错
          setTimeout(() => {
            this.getHistoryData(asset.code);
          }, 200);
        }
      });
      
      wx.setNavigationBarTitle({ title: asset.name });
    }
  },

  // 跳转去加仓/记一笔
  goAddPosition() {
    const asset = this.data.asset;
    const app = getApp();
    // 把当前资产信息存入全局，传给记账页
    app.globalData.tempAsset = {
      name: asset.name,
      code: asset.code,
      type: asset.type
    };
    wx.switchTab({ url: '/pages/add/add' });
  },

  // --- 图表相关逻辑 ---
  
  getHistoryData(code) {
    // 1. 尝试获取图表组件
    const ecComponent = this.selectComponent('#mychart-dom-line');

    // 🛑 防崩溃检查：如果组件还没渲染出来，直接停止
    if (!ecComponent) {
      console.log('图表组件未找到，跳过绘图');
      return;
    }

    // 2. 初始化图表
    ecComponent.init((canvas, width, height, dpr) => {
      chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      chart.showLoading(); 
      
      // 调用云函数查历史数据
      wx.cloud.callFunction({
        name: 'getFundData',
        data: { type: 'history', codes: [code] }
      }).then(res => {
        chart.hideLoading();
        const history = res.result.data.history || [];
        this.data.allHistory = history;
        // 默认显示近1月
        this.updateChartData('1m');
      }).catch(err => {
        console.error('获取走势失败', err);
        chart.hideLoading();
      });
      return chart;
    });
  },

  // 切换时间范围 (近1月/近1年/全部)
  switchRange(e) {
    const range = e.currentTarget.dataset.range;
    if (range === this.data.currentRange) return;
    this.setData({ currentRange: range });
    this.updateChartData(range);
  },

  // 更新图表数据
  updateChartData(range) {
    if (!this.data.allHistory.length) return;
    let chartData = [];
    const all = this.data.allHistory;
    
    // 根据范围截取数据
    if (range === '1m') chartData = all.slice(-22); // 近22个交易日
    else if (range === '1y') chartData = all.slice(-250); // 近250个交易日
    else chartData = all; // 全部

    // ✨ 将数据、资产信息、成本价一起传给绘图函数
    this.setChartOption(chartData, this.data.asset, this.data.costPrice);
  },

  // 核心绘图逻辑 (包含日期格式化、买入点、成本线)
  setChartOption(dataList, asset, costPrice) {
    if (!chart) return;
    
    const dates = dataList.map(item => item.date);
    const values = dataList.map(item => item.value);

    // --- 🎯 寻找买入点 ---
    let markPointData = [];
    if (asset && asset.buyDate) {
      // 在当前图表的时间范围内查找买入日期
      const buyIndex = dates.indexOf(asset.buyDate);
      
      if (buyIndex !== -1) {
        markPointData.push({
          name: '买入',
          coord: [buyIndex, values[buyIndex]], // 坐标
          value: '买入',
          itemStyle: { color: '#FA5151' } // 红色气泡
        });
      }
    }

    const option = {
      color: ["#1A73E8"],
      // 调整边距，防止文字被切掉
      grid: { left: '12%', right: '12%', bottom: '15%', top: '15%' },
      
      tooltip: {
        trigger: 'axis',
        formatter: '{b}\n净值: {c}',
        axisPointer: { type: 'line', lineStyle: { color: '#1A73E8', type: 'dashed' } }
      },
      
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { show: false },
        axisTick: { show: false },
        // ✨ 横轴日期格式化：只显示 "月-日"
        axisLabel: {
          show: true,
          color: '#999',
          fontSize: 10,
          formatter: function (value) {
            // value 格式通常为 "2026-01-29"，截取后5位 "01-29"
            return value.length > 5 ? value.substring(5) : value;
          }
        }
      },
      
      yAxis: {
        type: 'value',
        scale: true, // 不强制从0开始，显示波动细节
        splitLine: { lineStyle: { color: '#f5f5f5' } },
        axisLabel: { color: '#999', fontSize: 10 }
      },
      
      series: [{
        name: '净值',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(26, 115, 232, 0.2)' },
            { offset: 1, color: 'rgba(26, 115, 232, 0.01)' }
          ])
        },
        data: values,

        // ✨ 标注买入点
        markPoint: {
          symbol: 'pin',
          symbolSize: 40,
          label: { show: true, fontSize: 10, color: '#fff' },
          data: markPointData
        },

        // ✨ 标注成本线
        markLine: {
          symbol: ['none', 'none'],
          label: { show: true, position: 'end', color: '#FA5151', formatter: '成本\n{c}' },
          lineStyle: { color: '#FA5151', type: 'dashed', width: 1 },
          data: [
            { yAxis: costPrice } 
          ]
        }
      }]
    };
    
    chart.setOption(option);
  }
});