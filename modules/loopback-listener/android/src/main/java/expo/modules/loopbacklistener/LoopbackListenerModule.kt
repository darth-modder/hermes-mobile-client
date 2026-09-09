package expo.modules.loopbacklistener

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.InetAddress
import java.net.ServerSocket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.URLDecoder

// M08 (docs/CONNECTING.md, project-planning/implementation-plan/M08-portal-oauth.md): the
// RFC 8252 native-app loopback redirect listener. hermes serve's
// `_validate_loopback_redirect_uri` (hermes_cli/dashboard_auth/routes.py) accepts only
// http://127.0.0.1[:port]/... or http://[::1][:port]/... — private-use URI schemes are
// rejected — so the phone answers the OAuth redirect on a real loopback socket, exactly the
// way the desktop app's electron/native-oauth.ts does with Node's http.Server. `start()` binds
// a ServerSocket on 127.0.0.1:0 (OS picks a free port) and returns the port so the caller can
// build the redirect_uri before opening the browser; `waitForCallback()` blocks (on the Expo
// modules background queue — AsyncFunction bodies do not run on the JS or UI thread) for the
// browser's single GET, parses its query string, serves a small "return to the app" page, and
// resolves with the raw params. Deliberately dumb about the params' meaning (missing `code`,
// a present `error`, a `state` mismatch): interpreting the callback is src/net/auth/
// native-login.ts's job, mirroring native-oauth.ts's own split between the pure decision
// helpers and the transport.
private const val LISTEN_TIMEOUT_MS = 120_000 // 2-minute lifetime (task spec)
private const val READ_TIMEOUT_MS = 5_000 // once a peer connects, it must send its request promptly

private val RETURN_PAGE_HTML =
  """
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Hermes</title>
    </head>
    <body style="font-family: -apple-system, Roboto, sans-serif; text-align: center; padding-top: 3rem; color: #0B0B0F;">
      <p>You're signed in. You can return to the Hermes app.</p>
    </body>
  </html>
  """.trimIndent()

internal class LoopbackListenerStartException(cause: Throwable) :
  CodedException("ERR_LOOPBACK_START", "Could not open the loopback listener: ${cause.message}", cause)

internal class LoopbackListenerNotStartedException :
  CodedException("ERR_LOOPBACK_NOT_STARTED", "start() must be called before waitForCallback()", null)

internal class LoopbackListenerTimeoutException :
  CodedException("ERR_LOOPBACK_TIMEOUT", "No callback arrived within 2 minutes.", null)

internal class LoopbackListenerCancelledException :
  CodedException("ERR_LOOPBACK_CANCELLED", "Loopback listener was stopped before a callback arrived.", null)

internal class LoopbackListenerRequestException(message: String) :
  CodedException("ERR_LOOPBACK_REQUEST", message, null)

class LoopbackListenerModule : Module() {
  private var serverSocket: ServerSocket? = null

  override fun definition() = ModuleDefinition {
    Name("LoopbackListener")

    // Returns the bound port. Any previous, still-open listener (an abandoned
    // login attempt) is closed first — only one loopback wait is meaningful at
    // a time.
    AsyncFunction("start") {
      stopInternal()

      val socket =
        try {
          ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))
        } catch (e: Exception) {
          throw LoopbackListenerStartException(e)
        }

      socket.soTimeout = LISTEN_TIMEOUT_MS
      serverSocket = socket

      return@AsyncFunction socket.localPort
    }

    // Blocks until the browser's single GET /cb?... arrives, the 2-minute
    // deadline passes, or stop() is called from elsewhere (cancellation).
    // Resolves with every query parameter the request carried, unparsed —
    // the caller decides what `code`/`state`/`error` mean.
    AsyncFunction("waitForCallback") {
      val socket = serverSocket ?: throw LoopbackListenerNotStartedException()

      try {
        return@AsyncFunction acceptOne(socket)
      } catch (e: SocketTimeoutException) {
        throw LoopbackListenerTimeoutException()
      } catch (e: SocketException) {
        // stop() closed the socket out from under a pending accept().
        throw LoopbackListenerCancelledException()
      } finally {
        stopInternal()
      }
    }

    AsyncFunction("stop") {
      stopInternal()
    }

    OnDestroy {
      stopInternal()
    }
  }

  private fun stopInternal() {
    try {
      serverSocket?.close()
    } catch (_: Exception) {
      // Already closed, or never successfully opened — nothing to clean up.
    }

    serverSocket = null
  }

  private fun acceptOne(server: ServerSocket): Map<String, String> {
    server.accept().use { client ->
      client.soTimeout = READ_TIMEOUT_MS

      val reader = BufferedReader(InputStreamReader(client.getInputStream(), Charsets.UTF_8))
      val requestLine = reader.readLine() ?: throw LoopbackListenerRequestException("Empty request")

      // Drain headers so the client isn't left waiting on us to read a body it
      // never gets a response until we do (a GET redirect carries no body, but
      // some browsers still send an empty terminating CRLF only after headers).
      while (true) {
        val line = reader.readLine() ?: break

        if (line.isEmpty()) {
          break
        }
      }

      val requestParts = requestLine.split(" ")

      if (requestParts.size < 2) {
        throw LoopbackListenerRequestException("Malformed request line: $requestLine")
      }

      val target = requestParts[1]
      val query = target.substringAfter('?', "")
      val params = parseQuery(query)

      val body = RETURN_PAGE_HTML.toByteArray(Charsets.UTF_8)
      val head =
        "HTTP/1.1 200 OK\r\n" +
          "Content-Type: text/html; charset=utf-8\r\n" +
          "Content-Length: ${body.size}\r\n" +
          "Connection: close\r\n" +
          "\r\n"

      val output = client.getOutputStream()
      output.write(head.toByteArray(Charsets.US_ASCII))
      output.write(body)
      output.flush()

      return params
    }
  }

  private fun parseQuery(query: String): Map<String, String> {
    if (query.isEmpty()) {
      return emptyMap()
    }

    return query.split("&").mapNotNull { pair ->
      if (pair.isEmpty()) {
        return@mapNotNull null
      }

      val idx = pair.indexOf('=')
      val key = if (idx >= 0) pair.substring(0, idx) else pair
      val value = if (idx >= 0) pair.substring(idx + 1) else ""

      URLDecoder.decode(key, "UTF-8") to URLDecoder.decode(value, "UTF-8")
    }.toMap()
  }
}
