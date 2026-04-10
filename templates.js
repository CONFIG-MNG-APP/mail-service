/**
 * Email Templates for ABAP19 SAP Fiori Config Management
 * Each template returns { subject, html } based on event payload
 */

function baseLayout(title, bodyHtml, accentColor) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f4f6f8; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: ${accentColor}; color: #fff; padding: 20px 24px;">
      <h2 style="margin: 0; font-size: 20px;">${title}</h2>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">ABAP19 - SAP Fiori Configuration Management</p>
    </div>
    <div style="padding: 24px; color: #333; line-height: 1.6;">
      ${bodyHtml}
    </div>
    <div style="padding: 16px 24px; background: #f8f9fa; border-top: 1px solid #e9ecef; font-size: 12px; color: #6c757d; text-align: center;">
      Đây là email tự động từ hệ thống ABAP19 - Vui lòng không trả lời.
    </div>
  </div>
</body>
</html>`;
}

function detailsTable(rows) {
  var html = '<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">';
  rows.forEach(function(r) {
    if (r[1]) {
      html += '<tr><td style="padding: 8px 0; color: #6c757d; width: 140px;">' + r[0] + '</td>';
      html += '<td style="padding: 8px 0; color: #212529; font-weight: 500;">' + r[1] + '</td></tr>';
    }
  });
  html += '</table>';
  return html;
}

var templates = {

  SUBMITTED: function(p) {
    return {
      subject: '[ABAP19] Yêu cầu cấu hình mới cần phê duyệt: ' + (p.reqTitle || p.reqId),
      html: baseLayout(
        'Yêu cầu chờ phê duyệt',
        '<p>Xin chào Manager,</p>' +
        '<p>Có một yêu cầu cấu hình mới vừa được gửi và đang chờ bạn phê duyệt:</p>' +
        detailsTable([
          ['Tiêu đề:', p.reqTitle],
          ['Mã yêu cầu:', p.reqId],
          ['Module:', p.module],
          ['Người tạo:', p.triggeredBy],
          ['Môi trường:', p.envId]
        ]) +
        '<p>Vui lòng đăng nhập vào Manager App để xem chi tiết và thực hiện phê duyệt.</p>',
        '#0a6ed1'
      )
    };
  },

  APPROVED: function(p) {
    return {
      subject: '[ABAP19] Yêu cầu đã được phê duyệt: ' + (p.reqTitle || p.reqId),
      html: baseLayout(
        'Yêu cầu đã được phê duyệt',
        '<p>Xin chào,</p>' +
        '<p>Yêu cầu cấu hình của bạn đã được phê duyệt thành công:</p>' +
        detailsTable([
          ['Tiêu đề:', p.reqTitle],
          ['Mã yêu cầu:', p.reqId],
          ['Module:', p.module],
          ['Phê duyệt bởi:', p.triggeredBy]
        ]) +
        '<p>Yêu cầu sẽ được IT Admin xử lý áp dụng vào hệ thống.</p>',
        '#107e3e'
      )
    };
  },

  REJECTED: function(p) {
    return {
      subject: '[ABAP19] Yêu cầu bị từ chối: ' + (p.reqTitle || p.reqId),
      html: baseLayout(
        'Yêu cầu bị từ chối',
        '<p>Xin chào,</p>' +
        '<p>Yêu cầu cấu hình của bạn đã bị từ chối:</p>' +
        detailsTable([
          ['Tiêu đề:', p.reqTitle],
          ['Mã yêu cầu:', p.reqId],
          ['Module:', p.module],
          ['Từ chối bởi:', p.triggeredBy]
        ]) +
        (p.reason ?
          '<div style="background: #fff4e5; border-left: 4px solid #e9730c; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">' +
          '<strong>Lý do từ chối:</strong><br>' + p.reason +
          '</div>' : '') +
        '<p>Vui lòng xem lại và chỉnh sửa yêu cầu nếu cần.</p>',
        '#bb0000'
      )
    };
  },

  PROMOTED: function(p) {
    return {
      subject: '[ABAP19] Yêu cầu đã được promote lên ' + p.envId + ': ' + (p.reqTitle || p.reqId),
      html: baseLayout(
        'Yêu cầu đã được promote',
        '<p>Xin chào,</p>' +
        '<p>Yêu cầu cấu hình đã được chuyển lên môi trường tiếp theo:</p>' +
        detailsTable([
          ['Tiêu đề:', p.reqTitle],
          ['Mã yêu cầu:', p.reqId],
          ['Module:', p.module],
          ['Môi trường mới:', p.envId],
          ['Thực hiện bởi:', p.triggeredBy]
        ]),
        '#0a6ed1'
      )
    };
  },

  ROLLED_BACK: function(p) {
    return {
      subject: '[ABAP19] Yêu cầu đã được rollback tại ' + p.envId + ': ' + (p.reqTitle || p.reqId),
      html: baseLayout(
        'Yêu cầu đã được rollback',
        '<p>Xin chào,</p>' +
        '<p>Yêu cầu cấu hình đã được rollback tại một môi trường:</p>' +
        detailsTable([
          ['Tiêu đề:', p.reqTitle],
          ['Mã yêu cầu:', p.reqId],
          ['Module:', p.module],
          ['Môi trường rollback:', p.envId],
          ['Thực hiện bởi:', p.triggeredBy]
        ]) +
        '<p>Dữ liệu cấu hình đã được khôi phục về trạng thái trước đó.</p>',
        '#e9730c'
      )
    };
  },

  ACTIVE: function(p) {
    return {
      subject: '[ABAP19] Yêu cầu đã được áp dụng vào ' + p.envId + ': ' + (p.reqTitle || p.reqId),
      html: baseLayout(
        'Yêu cầu đã được áp dụng',
        '<p>Xin chào IT Admin,</p>' +
        '<p>Yêu cầu cấu hình đã được áp dụng thành công vào môi trường:</p>' +
        detailsTable([
          ['Tiêu đề:', p.reqTitle],
          ['Mã yêu cầu:', p.reqId],
          ['Module:', p.module],
          ['Môi trường:', p.envId],
          ['Thực hiện bởi:', p.triggeredBy]
        ]) +
        '<p>Bạn có thể tiếp tục promote lên môi trường cao hơn khi sẵn sàng.</p>',
        '#107e3e'
      )
    };
  }

};

module.exports = templates;
