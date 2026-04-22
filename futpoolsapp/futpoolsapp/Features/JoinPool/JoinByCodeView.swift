//
//  JoinByCodeView.swift
//  futpoolsapp
//
//  Manual invite code entry. Complements the deep-link flow for users who
//  received the code out-of-band (WhatsApp text, verbal, poster, etc.).
//

import SwiftUI

struct JoinByCodeView: View {
    @Environment(\.dismiss) private var dismiss
    /// Parent owns the navigation target. Passing back a resolved pool lets the
    /// parent `.navigationDestination` push `QuinielaDetailView` without this
    /// sheet needing its own nav stack.
    var onResolved: (Quiniela) -> Void

    @State private var code: String = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @FocusState private var codeFocused: Bool

    private let client = APIClient.shared

    /// Our invite codes are 8 chars from the no-confusables alphabet used by
    /// `mintUniqueInviteCode` on the backend. Same set here so the UI matches.
    private static let allowedChars: Set<Character> = Set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
    private static let codeLength = 8

    private var normalizedCode: String {
        code.uppercased()
            .filter { Self.allowedChars.contains($0) }
            .prefix(Self.codeLength)
            .map(String.init)
            .joined()
    }

    private var canSubmit: Bool {
        normalizedCode.count == Self.codeLength && !isSubmitting
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ArenaBackground()
                VStack(alignment: .leading, spacing: 24) {
                    header
                    codeSlots
                    if let err = errorMessage {
                        Text(err)
                            .font(ArenaFont.mono(size: 11))
                            .foregroundColor(.arenaDanger)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Spacer()
                    ArcadeButton(
                        title: isSubmitting ? NSLocalizedString("JOINING…", comment: "") : "▶ \(NSLocalizedString("JOIN POOL", comment: ""))",
                        size: .lg,
                        fullWidth: true,
                        disabled: !canSubmit
                    ) {
                        Task { await submit() }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 20)
            }
            .navigationTitle(Text(NSLocalizedString("JOIN WITH CODE", comment: "")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(NSLocalizedString("Cancel", comment: "")) { dismiss() }
                        .foregroundColor(.arenaTextDim)
                }
                ToolbarItem(placement: .keyboard) {
                    HStack {
                        Spacer()
                        Button(NSLocalizedString("Paste", comment: "")) { pasteFromClipboard() }
                    }
                }
            }
            .onAppear { codeFocused = true }
        }
    }

    // MARK: Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "ticket.fill")
                .font(.system(size: 40))
                .foregroundColor(.arenaPrimary)
                .shadow(color: .arenaPrimary.opacity(0.5), radius: 10)
            Text(NSLocalizedString("Have an invite code?", comment: ""))
                .font(ArenaFont.display(size: 20, weight: .heavy))
                .foregroundColor(.arenaText)
            Text(NSLocalizedString("Enter the 8-character code your friend shared to jump straight into their pool.", comment: ""))
                .font(ArenaFont.mono(size: 11))
                .foregroundColor(.arenaTextMuted)
                .lineLimit(4)
        }
    }

    private var codeSlots: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(NSLocalizedString("INVITE CODE", comment: ""))
                .font(ArenaFont.mono(size: 10))
                .tracking(2)
                .foregroundColor(.arenaTextMuted)
            // Hard height cap on the slot row so SwiftUI can't expand the
            // cells vertically to fill the available Spacer space when the
            // user has a tall screen.
            slotRow
                .frame(height: 56)
                .contentShape(Rectangle())
                .onTapGesture { codeFocused = true }
        }
    }

    private var slotRow: some View {
        ZStack(alignment: .topLeading) {
            // Hidden text field captures keystrokes + paste + autofill (SMS
            // one-time codes). We sync it to `code` and render visuals below.
            TextField("", text: $code)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .keyboardType(.asciiCapable)
                .textContentType(.oneTimeCode)
                .focused($codeFocused)
                .opacity(0.01)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .onChange(of: code) { _, new in
                    let clean = new.uppercased()
                        .filter { Self.allowedChars.contains($0) }
                    code = String(clean.prefix(Self.codeLength))
                    errorMessage = nil
                }

            // Visible slots. `GeometryReader` splits the row width evenly
            // between the 8 slots regardless of device size — no stretching
            // and no manual magic numbers.
            GeometryReader { geo in
                let gap: CGFloat = 6
                let w = max((geo.size.width - gap * CGFloat(Self.codeLength - 1)) / CGFloat(Self.codeLength), 1)
                HStack(spacing: gap) {
                    ForEach(0..<Self.codeLength, id: \.self) { idx in
                        slot(at: idx)
                            .frame(width: w, height: geo.size.height)
                    }
                }
            }
            .allowsHitTesting(false)
        }
    }

    private func slot(at idx: Int) -> some View {
        let chars = Array(normalizedCode)
        let char = idx < chars.count ? String(chars[idx]) : ""
        let isCursor = idx == chars.count && codeFocused
        return ZStack {
            HudCornerCutShape(cut: 6)
                .fill(Color.arenaBg2)
            HudCornerCutShape(cut: 6)
                .stroke(isCursor ? Color.arenaPrimary : Color.arenaStroke, lineWidth: isCursor ? 1.5 : 1)
            Text(char)
                .font(ArenaFont.display(size: 22, weight: .heavy))
                .foregroundColor(.arenaPrimary)
            if isCursor && char.isEmpty {
                // Blinking-ish cursor hint in the active slot
                Rectangle()
                    .fill(Color.arenaPrimary)
                    .frame(width: 2, height: 22)
                    .opacity(0.7)
            }
        }
    }

    // MARK: Actions

    private func pasteFromClipboard() {
        guard let pasted = UIPasteboard.general.string else { return }
        code = pasted
    }

    private func submit() async {
        guard canSubmit else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            let pool: Quiniela = try await client.request(
                method: "GET",
                path: "/quinielas/invite/\(normalizedCode)"
            )
            onResolved(pool)
            dismiss()
        } catch {
            errorMessage = NSLocalizedString("Invalid or expired code. Double-check and try again.", comment: "")
        }
    }
}
