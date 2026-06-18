//
//  HudShape.swift
//  futpoolsapp
//
//  SwiftUI Shapes that recreate the CSS clip-path corner cuts used
//  throughout the Arena design (top-left + bottom-right corners cut,
//  giving a Destiny/Apex HUD feel).
//

import SwiftUI

/// Corner-cut rectangle: top-left corner + bottom-right corner are clipped.
struct HudCornerCutShape: Shape {
    /// The depth of the 45° cut, in points.
    var cut: CGFloat = 14

    func path(in rect: CGRect) -> Path {
        let c = min(cut, min(rect.width, rect.height) / 2)
        var p = Path()
        p.move(to: CGPoint(x: rect.minX + c, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX,   y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX,   y: rect.maxY - c))
        p.addLine(to: CGPoint(x: rect.maxX - c, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX,   y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX,   y: rect.minY + c))
        p.closeSubpath()
        return p
    }
}

/// Parallelogram chip — used for HUD status pills. Cuts top-right + bottom-left.
struct HudChipShape: Shape {
    var cut: CGFloat = 6

    func path(in rect: CGRect) -> Path {
        let c = min(cut, min(rect.width, rect.height) / 2)
        var p = Path()
        p.move(to: CGPoint(x: rect.minX + c, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX,   y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX - c, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX,   y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

/// Hex shield — used for team crests.
struct HexShieldShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width, h = rect.height
        var p = Path()
        p.move(to: CGPoint(x: rect.midX,        y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX,     y: rect.minY + h * 0.22))
        p.addLine(to: CGPoint(x: rect.maxX,     y: rect.minY + h * 0.75))
        p.addLine(to: CGPoint(x: rect.midX,     y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX,     y: rect.minY + h * 0.75))
        p.addLine(to: CGPoint(x: rect.minX,     y: rect.minY + h * 0.22))
        p.closeSubpath()
        _ = w
        return p
    }
}

/// Division badge shield (slightly different proportions from team crest).
struct DivisionShieldShape: Shape {
    func path(in rect: CGRect) -> Path {
        let h = rect.height
        var p = Path()
        p.move(to: CGPoint(x: rect.midX,    y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + h * 0.25))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + h * 0.70))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY + h * 0.70))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY + h * 0.25))
        p.closeSubpath()
        return p
    }
}

/// Podium block — top-left corner cut only (flat right, flat bottom).
struct PodiumBlockShape: Shape {
    var cut: CGFloat = 8

    func path(in rect: CGRect) -> Path {
        let c = min(cut, min(rect.width, rect.height) / 2)
        var p = Path()
        p.move(to: CGPoint(x: rect.minX + c, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX,   y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX,   y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX,   y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX,   y: rect.minY + c))
        p.closeSubpath()
        return p
    }
}
