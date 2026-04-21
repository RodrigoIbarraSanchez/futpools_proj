//
//  TeamCrestArena.swift
//  futpoolsapp
//

import SwiftUI

struct TeamCrestArena: View {
    let name: String
    var color: Color = .arenaAccent
    var size: CGFloat = 36
    var logoURL: String? = nil

    private var initials: String {
        name.split(separator: " ")
            .prefix(2)
            .map { String($0.prefix(1)) }
            .joined()
            .uppercased()
    }

    var body: some View {
        ZStack {
            if let logoURL, let url = URL(string: logoURL) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFit()
                    default:
                        initialsFallback
                    }
                }
            } else {
                initialsFallback
            }
        }
        .frame(width: size, height: size)
    }

    private var initialsFallback: some View {
        ZStack {
            Circle()
                .fill(Color.arenaSurfaceAlt)
            Circle()
                .stroke(color.opacity(0.4), lineWidth: 1)
            Text(initials)
                .font(ArenaFont.display(size: size * 0.34, weight: .heavy))
                .foregroundColor(.arenaText)
        }
    }
}
