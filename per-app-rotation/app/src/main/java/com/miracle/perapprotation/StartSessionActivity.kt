package com.miracle.perapprotation

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import com.miracle.perapprotation.session.SessionStarter
import com.miracle.perapprotation.session.StartResult

/**
 * Invisible trampoline started by the home-screen widget or shortcut. Starts a session and
 * finishes immediately — it never shows UI of its own.
 */
class StartSessionActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        when (SessionStarter.start(this)) {
            StartResult.STARTED -> Unit

            StartResult.NO_TARGET -> {
                toast("실행할 앱을 먼저 등록하세요.")
                openSettingsScreen()
            }

            StartResult.NO_PERMISSION -> {
                toast("'설정 수정 허용' 권한이 필요합니다.")
                openSettingsScreen()
            }

            StartResult.LAUNCH_FAILED -> toast("앱을 실행할 수 없습니다.")
        }
        finish()
    }

    private fun openSettingsScreen() {
        startActivity(
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
}
