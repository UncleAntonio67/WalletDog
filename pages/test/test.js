Page({
  data: {
    loading: false,
    log: '准备就绪...',
    envId: 'cloud-base' // 你的环境ID
  },

  // 清空数据
  handleClear() {
    this.callCloud('clear', '正在清空...');
  },

  // 生成数据
  handleInit() {
    this.callCloud('init', '正在生成40+条数据 (耗时约3秒)...');
  },

  callCloud(action, loadingText) {
    this.setData({ loading: true, log: loadingText });
    
    wx.cloud.callFunction({
      name: 'manageTestData',
      data: { action: action }
    }).then(res => {
      console.log(res);
      if (res.result.success) {
        this.setData({ 
          loading: false, 
          log: `✅ 操作成功: ${res.result.msg}\n请返回首页下拉刷新查看。` 
        });
        wx.showToast({ title: '成功', icon: 'success' });
      } else {
        this.setData({ loading: false, log: `❌ 失败: ${res.result.msg}` });
      }
    }).catch(err => {
      console.error(err);
      this.setData({ loading: false, log: `❌ 调用错误: ${err.message}` });
    });
  }
});