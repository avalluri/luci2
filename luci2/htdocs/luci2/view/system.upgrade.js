L.ui.view.extend({
	title: L.tr('Flash operations'),

	handle_flash_upload: function() {
		var self = this;
		L.ui.upload(
			L.tr('Firmware upload'),
			L.tr('Select the sysupgrade image to flash and click "%s" to proceed.').format(L.tr('Ok')), {
				filename: '/tmp/firmware.bin',
				success: function(info) {
					self.handle_flash_verify(info);
				}
			}
		);
	},

	handle_flash_verify: function(info) {
		var self = this;
		L.system.testUpgrade().then(function(res) {
			if (res.code == 0)
			{
				L.ui.dialog(
					L.tr('Verify firmware'), [
						$('<p />').text(L.tr('The firmware image was uploaded completely. Please verify the checksum and file size below, then click "%s" to start the flash procedure.').format(L.tr('Ok'))),
						$('<ul />')
							.append($('<li />')
								.append($('<strong />').text(L.tr('Checksum') + ': '))
								.append(info.checksum))
							.append($('<li />')
								.append($('<strong />').text(L.tr('Size') + ': '))
								.append('%1024mB'.format(info.size))),
						$('<label />')
							.append($('<input />')
								.attr('type', 'checkbox')
								.prop('checked', true))
							.append(' ')
							.append(L.tr('Keep configuration when reflashing'))
					], {
						style: 'confirm',
						confirm: function() {
							//L.system.startUpgrade().then(function() {
							//	L.ui.reconnect();
							//});

							alert('Flash...');
						}
					}
				);
			}
			else
			{
				L.ui.dialog(
					L.tr('Invalid image'), [
						$('<p />').text(L.tr('Firmware image verification failed, the "sysupgrade" command responded with the message below:')),
						$('<pre />')
							.addClass('alert-message')
							.text(res.stdout || res.stderr),
						$('<p />').text(L.tr('Image verification failed with code %d.').format(res.code))
					], {
						style: 'close',
						close: function() {
							L.system.cleanUpgrade().then(function() {
								L.ui.dialog(false);
							});
						}
					}
				);
			}
		});
	},

	handle_backup_upload: function() {
		var self = this;
		L.ui.upload(
			L.tr('Backup restore'),
			L.tr('Select the backup archive to restore and click "%s" to proceed.').format(L.tr('Ok')), {
				filename: '/tmp/backup.tar.gz',
				success: function(info) {
					self.handle_backup_verify(info);
				}
			}
		);
	},

	handle_backup_verify: function(info) {
		var self = this;
		L.ui.dialog(
			L.tr('Backup restore'), [
				$('<p />').text(L.tr('The backup archive was uploaded completely. Please verify the checksum and file size below, then click "%s" to restore the archive.').format(L.tr('Ok'))),
				$('<ul />')
					.append($('<li />')
						.append($('<strong />').text(L.tr('Checksum') + ': '))
						.append(info.checksum))
					.append($('<li />')
						.append($('<strong />').text(L.tr('Size') + ': '))
						.append('%1024mB'.format(info.size)))
			], {
				style: 'confirm',
				confirm: function() {
					self.handle_backup_restore();
				}
			}
		);
	},

	handle_backup_restore: function() {
		var self = this;
		L.system.restoreBackup().then(function(res) {
			if (res.code == 0)
			{
				L.ui.dialog(
					L.tr('Backup restore'), [
						$('<p />').text(L.tr('The backup was successfully restored, it is advised to reboot the system now in order to apply all configuration changes.')),
						$('<input />')
							.addClass('cbi-button')
							.attr('type', 'button')
							.attr('value', L.tr('Reboot system'))
							.click(function() { alert('Reboot...'); })
					], {
						style: 'close',
						close: function() {
							L.system.cleanBackup().then(function() {
								L.ui.dialog(false);
							});
						}
					}
				);
			}
			else
			{
				L.ui.dialog(
					L.tr('Backup restore'), [
						$('<p />').text(L.tr('Backup restoration failed, the "sysupgrade" command responded with the message below:')),
						$('<pre />')
							.addClass('alert-message')
							.text(res.stdout || res.stderr),
						$('<p />').text(L.tr('Backup restoration failed with code %d.').format(res.code))
					], {
						style: 'close',
						close: function() {
							L.system.cleanBackup().then(function() {
								L.ui.dialog(false);
							});
						}
					}
				);
			}
		});
	},

	handle_backup_download: function() {
		var form = $('#btn_backup').parent();

		form.find('[name=sessionid]').val(L.globals.sid);
		form.submit();
	},

	handle_reset: function() {
		L.ui.dialog(L.tr('Really reset all changes?'), L.tr('This will reset the system to its initial configuration, all changes made since the initial flash will be lost!'), {
			style: 'confirm',
			confirm: function() {
				//L.system.startReset().then(function() {
				//	L.ui.reconnect();
				//});

				alert('Reset...');
			}
		});
	},

	execute: function() {
		var self = this;

		L.system.testReset().then(function(reset_avail) {
			if (!reset_avail) {
				$('#btn_reset').prop('disabled', true);
			}

			if (!self.options.acls.backup) {
				$('#btn_restore, #btn_save, textarea').prop('disabled', true);
			}
			else {
				$('#btn_backup').click(function() { self.handle_backup_download(); });
				$('#btn_restore').click(function() { self.handle_backup_upload(); });
			}

			if (!self.options.acls.upgrade) {
				$('#btn_flash, #btn_reset').prop('disabled', true);
			}
			else {
				$('#btn_flash').click(function() { self.handle_flash_upload(); });
				$('#btn_reset').click(function() { self.handle_reset(); });
			}

			return L.system.getBackupConfig();
		}).then(function(config) {
			$('textarea')
				.attr('rows', (config.match(/\n/g) || [ ]).length + 1)
				.val(config);

			$('#btn_save')
				.click(function() {
					var data = ($('textarea').val() || '').replace(/\r/g, '').replace(/\n?$/, '\n');
					L.ui.loading(true);
					L.system.setBackupConfig(data).then(function() {
						$('textarea')
							.attr('rows', (data.match(/\n/g) || [ ]).length + 1)
							.val(data);

						L.ui.loading(false);
					});
				});

			$('#btn_list')
				.click(function() {
					L.ui.loading(true);
					L.system.listBackup().then(function(list) {
						L.ui.loading(false);
						L.ui.dialog(
							L.tr('Backup file list'),
							$('<textarea />')
								.css('width', '100%')
								.attr('rows', list.length)
								.prop('readonly', true)
								.val(list.join('\n')),
							{ style: 'close' }
						);
					});
				});
		}).then(function() {
			$('#tabs').show().tabs();
		});
	}
});