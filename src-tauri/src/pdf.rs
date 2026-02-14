use printpdf::{PdfDocument, Mm, BuiltinFont, Color, Rgb, Line, Point, Image, ImageTransform, Rect};
use std::fs::File;
use std::io::BufWriter;
use image as image_crate;

use crate::models::{Invoice, Settings, CustomTemplate};

/// Minimum y position (mm) before content overflows into footer area.
const MIN_CONTENT_Y: f32 = 35.0;

fn hex_to_rgb(hex: &str) -> (f32, f32, f32) {
    let hex = hex.trim_start_matches('#');
    if hex.len() >= 6 {
        let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0) as f32 / 255.0;
        let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0) as f32 / 255.0;
        let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0) as f32 / 255.0;
        (r, g, b)
    } else {
        (0.0, 0.0, 0.0)
    }
}

/// Helper: draw a filled rectangle
fn draw_rect(layer: &printpdf::PdfLayerReference, x: f32, y: f32, w: f32, h: f32, color: Color) {
    layer.set_fill_color(color);
    let rect = Rect::new(Mm(x), Mm(y), Mm(x + w), Mm(y + h));
    layer.add_rect(rect);
}

/// Helper: add logo image, returns the width used (in mm)
fn add_logo(layer: &printpdf::PdfLayerReference, logo_path: &str, x: f32, y: f32, max_h_mm: f32) -> f32 {
    if let Ok(img) = image_crate::open(logo_path) {
        let px_w = img.width() as f32;
        let px_h = img.height() as f32;
        // Calculate DPI so that the image renders at max_h_mm height
        // Formula: dpi = px_h * 25.4 / max_h_mm
        let dpi = px_h * 25.4 / max_h_mm;
        let rendered_w_mm = px_w * 25.4 / dpi; // = max_h_mm * (px_w / px_h)
        let pdf_img = Image::from_dynamic_image(&img);
        pdf_img.add_to_layer(layer.clone(), ImageTransform {
            translate_x: Some(Mm(x)),
            translate_y: Some(Mm(y)),
            rotate: None,
            scale_x: None,
            scale_y: None,
            dpi: Some(dpi),
        });
        rendered_w_mm + 5.0
    } else {
        0.0
    }
}

/// Helper: add an image (signature, QR, etc.) at a target height in mm
fn add_image(layer: &printpdf::PdfLayerReference, path: &str, x: f32, y: f32, max_h_mm: f32) {
    if let Ok(img) = image_crate::open(path) {
        let px_h = img.height() as f32;
        let dpi = px_h * 25.4 / max_h_mm;
        let pdf_img = Image::from_dynamic_image(&img);
        pdf_img.add_to_layer(layer.clone(), ImageTransform {
            translate_x: Some(Mm(x)),
            translate_y: Some(Mm(y)),
            rotate: None,
            scale_x: None,
            scale_y: None,
            dpi: Some(dpi),
        });
    }
}

/// Truncate text to fit within a maximum width (approximate)
fn truncate_text(text: &str, font_size: f32, max_width_mm: f32) -> String {
    let char_width = font_size * 0.176;
    let max_chars = (max_width_mm / char_width) as usize;
    let char_count = text.chars().count();
    if char_count > max_chars && max_chars > 3 {
        let truncated: String = text.chars().take(max_chars - 3).collect();
        format!("{}...", truncated)
    } else {
        text.to_string()
    }
}

/// Estimate text width in mm for Helvetica at a given font size.
fn text_width_mm(text: &str, font_size: f32) -> f32 {
    text.chars().count() as f32 * font_size * 0.176
}

/// Calculate x position so text right-edge lands at `right_edge_mm`.
fn right_x(text: &str, font_size: f32, right_edge_mm: f32) -> f32 {
    (right_edge_mm - text_width_mm(text, font_size)).max(0.0)
}

pub fn generate_invoice_pdf(
    invoice: &Invoice,
    settings: &Settings,
    file_path: &str,
    custom_template: Option<&CustomTemplate>,
) -> Result<String, String> {
    let (doc, page1, layer1) = PdfDocument::new(
        &format!("Invoice {}", invoice.invoice_number.as_deref().unwrap_or("")),
        Mm(210.0),
        Mm(297.0),
        "Layer 1",
    );

    let layer = doc.get_page(page1).get_layer(layer1);
    let font = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| e.to_string())?;
    let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold).map_err(|e| e.to_string())?;
    let font_italic = doc.add_builtin_font(BuiltinFont::HelveticaOblique).map_err(|e| e.to_string())?;

    let currency = &settings.currency_symbol;

    // Dispatch to the right template renderer
    let template_type = if custom_template.is_some() {
        "Custom"
    } else {
        settings.template_type.as_str()
    };

    match template_type {
        "Professional" => render_professional_pdf(&layer, &font, &font_bold, &font_italic, invoice, settings, currency),
        "Modern" => render_modern_pdf(&layer, &font, &font_bold, &font_italic, invoice, settings, currency),
        "ClearStyle" => render_ClearStyle_pdf(&layer, &font, &font_bold, &font_italic, invoice, settings, currency),
        _ => render_basic_pdf(&layer, &font, &font_bold, &font_italic, invoice, settings, currency, custom_template),
    }

    // Save
    let file = File::create(file_path).map_err(|e| e.to_string())?;
    doc.save(&mut BufWriter::new(file)).map_err(|e| e.to_string())?;

    Ok(file_path.to_string())
}

// ══════════════════════════════════════════════════════════
//  BASIC TEMPLATE
// ══════════════════════════════════════════════════════════
fn render_basic_pdf(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    font_bold: &printpdf::IndirectFontRef,
    _font_italic: &printpdf::IndirectFontRef,
    invoice: &Invoice,
    settings: &Settings,
    currency: &str,
    custom_template: Option<&CustomTemplate>,
) {
    let accent = if let Some(ct) = custom_template {
        let (r, g, b) = hex_to_rgb(&ct.accent_color);
        Color::Rgb(Rgb::new(r, g, b, None))
    } else {
        Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None))
    };
    let black = Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None));
    let gray = Color::Rgb(Rgb::new(0.4, 0.4, 0.4, None));

    let mut y: f32 = 275.0;

    // Logo + Business Name
    let mut text_x: f32 = 20.0;
    if let Some(ref logo_path) = settings.logo_path {
        let w = add_logo(layer, logo_path, 20.0, y - 16.0, 22.0);
        if w > 0.0 { text_x = 20.0 + w; }
    }

    layer.set_fill_color(accent.clone());
    layer.use_text(&settings.business_name, 18.0, Mm(text_x), Mm(y), font_bold);
    layer.set_fill_color(gray.clone());
    y -= 6.0;
    if let Some(ref addr) = settings.business_address {
        layer.use_text(addr, 8.0, Mm(text_x), Mm(y), font);
        y -= 4.0;
    }
    if let Some(ref phone) = settings.business_phone {
        layer.use_text(&format!("Phone: {}", phone), 8.0, Mm(text_x), Mm(y), font);
        y -= 4.0;
    }
    if let Some(ref email) = settings.business_email {
        layer.use_text(&format!("Email: {}", email), 8.0, Mm(text_x), Mm(y), font);
    }

    // Separator line
    y -= 6.0;
    layer.set_outline_color(black.clone());
    let sep = Line {
        points: vec![
            (Point::new(Mm(20.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(sep);

    // Invoice # and dates on right
    layer.set_fill_color(black.clone());
    layer.use_text("INVOICE", 10.0, Mm(155.0), Mm(y - 5.0), font_bold);
    layer.use_text(&format!("# {}", invoice.invoice_number.as_deref().unwrap_or("-")), 9.0, Mm(155.0), Mm(y - 10.0), font);
    layer.use_text(&format!("Issue Date: {}", &invoice.issue_date), 8.0, Mm(140.0), Mm(y - 16.0), font);
    layer.use_text(&format!("Due Date: {}", &invoice.due_date), 8.0, Mm(140.0), Mm(y - 20.5), font);
    layer.use_text(&format!("Status: {}", &invoice.status), 8.0, Mm(140.0), Mm(y - 25.0), font);

    // Bill To
    layer.set_fill_color(accent.clone());
    layer.use_text("Bill To:", 10.0, Mm(20.0), Mm(y - 5.0), font_bold);
    layer.set_fill_color(black.clone());
    layer.use_text(invoice.customer_name.as_deref().unwrap_or("—"), 9.0, Mm(20.0), Mm(y - 11.0), font);

    y -= 33.0;

    // Table
    y = render_items_table(layer, font, font_bold, invoice, settings, currency, y, accent.clone(), black.clone());

    // Totals
    y = render_totals(layer, font, font_bold, invoice, settings, currency, y, accent.clone(), black.clone());

    // Bank + Signature + Notes
    render_bottom_section(layer, font, font_bold, _font_italic, invoice, settings, y, black);
}

// ══════════════════════════════════════════════════════════
//  PROFESSIONAL TEMPLATE (Blue corporate with colored header bar)
// ══════════════════════════════════════════════════════════
fn render_professional_pdf(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    font_bold: &printpdf::IndirectFontRef,
    font_italic: &printpdf::IndirectFontRef,
    invoice: &Invoice,
    settings: &Settings,
    currency: &str,
) {
    let dark_blue = Color::Rgb(Rgb::new(0.118, 0.251, 0.682, None));  // #1e40af
    let mid_blue = Color::Rgb(Rgb::new(0.231, 0.510, 0.965, None));   // #3b82f6
    let white = Color::Rgb(Rgb::new(1.0, 1.0, 1.0, None));
    let black = Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None));
    let light_bg = Color::Rgb(Rgb::new(0.941, 0.973, 1.0, None));     // #f0f9ff
    let gray = Color::Rgb(Rgb::new(0.4, 0.46, 0.53, None));

    // ── Blue header banner ──
    draw_rect(layer, 0.0, 267.0, 210.0, 30.0, dark_blue.clone());

    layer.set_fill_color(white.clone());
    layer.use_text("INVOICE", 28.0, Mm(20.0), Mm(280.0), font_bold);
    layer.use_text(&settings.business_name, 12.0, Mm(20.0), Mm(272.0), font);

    // Invoice number on right, white text
    layer.use_text(&format!("# {}", invoice.invoice_number.as_deref().unwrap_or("-")), 12.0, Mm(150.0), Mm(280.0), font_bold);
    layer.use_text(&format!("Date: {}", &invoice.issue_date), 9.0, Mm(150.0), Mm(274.0), font);

    let mut y: f32 = 260.0;

    // Logo
    if let Some(ref logo_path) = settings.logo_path {
        add_logo(layer, logo_path, 20.0, y - 14.0, 20.0);
    }

    // FROM section
    layer.set_fill_color(mid_blue.clone());
    layer.use_text("FROM:", 9.0, Mm(20.0), Mm(y), font_bold);
    layer.set_fill_color(black.clone());
    layer.use_text(&settings.business_name, 10.0, Mm(20.0), Mm(y - 5.0), font_bold);
    let mut from_y = y - 10.0;
    if let Some(ref addr) = settings.business_address {
        layer.use_text(addr, 8.0, Mm(20.0), Mm(from_y), font);
        from_y -= 4.0;
    }
    if let Some(ref phone) = settings.business_phone {
        layer.use_text(phone, 8.0, Mm(20.0), Mm(from_y), font);
        from_y -= 4.0;
    }
    if let Some(ref email) = settings.business_email {
        layer.use_text(email, 8.0, Mm(20.0), Mm(from_y), font);
    }

    // BILL TO section
    layer.set_fill_color(mid_blue.clone());
    layer.use_text("BILL TO:", 9.0, Mm(120.0), Mm(y), font_bold);
    layer.set_fill_color(black.clone());
    layer.use_text(invoice.customer_name.as_deref().unwrap_or("—"), 10.0, Mm(120.0), Mm(y - 5.0), font_bold);
    if let Some(ref phone) = invoice.customer_phone {
        layer.use_text(&format!("Tel: {}", phone), 8.0, Mm(120.0), Mm(y - 10.0), font);
    }

    y -= 25.0;

    // Info boxes row (light blue background)
    draw_rect(layer, 20.0, y - 8.0, 170.0, 15.0, light_bg.clone());
    layer.set_fill_color(gray.clone());
    layer.use_text("INVOICE #", 7.0, Mm(25.0), Mm(y + 2.0), font);
    layer.use_text("ISSUE DATE", 7.0, Mm(80.0), Mm(y + 2.0), font);
    layer.use_text("DUE DATE", 7.0, Mm(135.0), Mm(y + 2.0), font);
    layer.set_fill_color(black.clone());
    layer.use_text(invoice.invoice_number.as_deref().unwrap_or("-"), 11.0, Mm(25.0), Mm(y - 4.0), font_bold);
    layer.use_text(&invoice.issue_date, 11.0, Mm(80.0), Mm(y - 4.0), font_bold);
    layer.set_fill_color(mid_blue.clone());
    layer.use_text(&invoice.due_date, 11.0, Mm(135.0), Mm(y - 4.0), font_bold);

    y -= 18.0;

    // Table with blue header
    draw_rect(layer, 20.0, y - 2.0, 170.0, 8.0, dark_blue.clone());
    layer.set_fill_color(white.clone());
    layer.use_text("No", 8.0, Mm(23.0), Mm(y), font_bold);
    layer.use_text("DESCRIPTION", 8.0, Mm(33.0), Mm(y), font_bold);
    layer.use_text("QTY", 8.0, Mm(98.0), Mm(y), font_bold);
    layer.use_text("RATE", 8.0, Mm(115.0), Mm(y), font_bold);
    layer.use_text("TAX", 8.0, Mm(142.0), Mm(y), font_bold);
    let th = "AMOUNT";
    layer.use_text(th, 8.0, Mm(right_x(th, 8.0, 188.0)), Mm(y), font_bold);

    y -= 8.0;
    layer.set_fill_color(black.clone());

    if let Some(ref items) = invoice.items {
        for (i, item) in items.iter().enumerate() {
            if y < MIN_CONTENT_Y { break; }
            // Alternate row background
            if i % 2 == 0 {
                draw_rect(layer, 20.0, y - 2.0, 170.0, 7.0, light_bg.clone());
            }
            layer.set_fill_color(black.clone());
            layer.use_text(&format!("{}", i + 1), 9.0, Mm(23.0), Mm(y), font);
            let name = truncate_text(&item.product_name, 9.0, 55.0);
            layer.use_text(&name, 9.0, Mm(33.0), Mm(y), font);
            layer.use_text(&item.quantity.to_string(), 9.0, Mm(98.0), Mm(y), font);
            let up = format!("{}{:.2}", currency, item.unit_price);
            layer.use_text(&up, 9.0, Mm(115.0), Mm(y), font);
            layer.use_text(&format!("{:.0}%", item.tax_percent), 9.0, Mm(142.0), Mm(y), font);
            let lt = format!("{}{:.2}", currency, item.line_total);
            layer.use_text(&lt, 9.0, Mm(right_x(&lt, 9.0, 188.0)), Mm(y), font_bold);

            // Description sub-line
            if let Some(ref desc) = item.description {
                if !desc.is_empty() {
                    y -= 4.0;
                    layer.set_fill_color(gray.clone());
                    let desc_text = truncate_text(desc, 7.0, 60.0);
                    layer.use_text(&desc_text, 7.0, Mm(33.0), Mm(y), font);
                    layer.set_fill_color(black.clone());
                }
            }

            // Row separator
            y -= 1.5;
            layer.set_outline_color(Color::Rgb(Rgb::new(0.88, 0.91, 1.0, None)));
            let row_line = Line {
                points: vec![
                    (Point::new(Mm(20.0), Mm(y)), false),
                    (Point::new(Mm(190.0), Mm(y)), false),
                ],
                is_closed: false,
            };
            layer.add_line(row_line);
            y -= 5.5;
        }
    }

    // Totals with blue accent (right-aligned box)
    y -= 4.0;
    // Calculate totals box height dynamically
    let mut totals_h: f32 = 22.0; // base: subtotal + tax + separator + total
    if invoice.advance > 0.0 { totals_h += 5.0; }
    if invoice.discount_percent > 0.0 || invoice.discount > 0.0 { totals_h += 5.0; }
    draw_rect(layer, 120.0, y - (totals_h - 5.0), 70.0, totals_h, light_bg.clone());
    // Blue left border
    draw_rect(layer, 120.0, y - (totals_h - 5.0), 1.5, totals_h, mid_blue.clone());

    layer.set_fill_color(gray.clone());
    layer.use_text("Subtotal:", 9.0, Mm(125.0), Mm(y), font);
    layer.set_fill_color(black.clone());
    let v = format!("{}{:.2}", currency, invoice.subtotal);
    layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), font_bold);
    y -= 5.0;

    layer.set_fill_color(gray.clone());
    layer.use_text(&format!("{}:", &settings.tax_label), 9.0, Mm(125.0), Mm(y), font);
    layer.set_fill_color(black.clone());
    let v = format!("{}{:.2}", currency, invoice.tax);
    layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), font_bold);
    y -= 5.0;

    if invoice.advance > 0.0 {
        layer.set_fill_color(gray.clone());
        layer.use_text("Advance:", 9.0, Mm(125.0), Mm(y), font);
        layer.set_fill_color(black.clone());
        let v = format!("-{}{:.2}", currency, invoice.advance);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), font);
        y -= 5.0;
    }
    if invoice.discount_percent > 0.0 {
        let disc_amt = (invoice.subtotal + invoice.tax) * invoice.discount_percent / 100.0;
        layer.set_fill_color(gray.clone());
        layer.use_text(&format!("Discount ({:.0}%):", invoice.discount_percent), 9.0, Mm(125.0), Mm(y), font);
        layer.set_fill_color(black.clone());
        let v = format!("-{}{:.2}", currency, disc_amt);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), font);
        y -= 5.0;
    } else if invoice.discount > 0.0 {
        layer.set_fill_color(gray.clone());
        layer.use_text("Discount:", 9.0, Mm(125.0), Mm(y), font);
        layer.set_fill_color(black.clone());
        let v = format!("-{}{:.2}", currency, invoice.discount);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), font);
        y -= 5.0;
    }

    // Separator
    y -= 1.0;
    layer.set_outline_color(Color::Rgb(Rgb::new(0.75, 0.86, 0.99, None)));
    let sep = Line {
        points: vec![
            (Point::new(Mm(125.0), Mm(y)), false),
            (Point::new(Mm(188.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(sep);
    y -= 5.0;

    layer.set_fill_color(mid_blue.clone());
    layer.use_text("TOTAL:", 12.0, Mm(125.0), Mm(y), font_bold);
    let v = format!("{}{:.2}", currency, invoice.total);
    layer.use_text(&v, 12.0, Mm(right_x(&v, 12.0, 188.0)), Mm(y), font_bold);

    y -= 15.0;

    // Bank + Signature + Notes
    render_bottom_section(layer, font, font_bold, font_italic, invoice, settings, y, black);
}

// ══════════════════════════════════════════════════════════
//  MODERN TEMPLATE (Gradient, clean lines)
// ══════════════════════════════════════════════════════════
fn render_modern_pdf(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    font_bold: &printpdf::IndirectFontRef,
    font_italic: &printpdf::IndirectFontRef,
    invoice: &Invoice,
    settings: &Settings,
    currency: &str,
) {
    let purple = Color::Rgb(Rgb::new(0.545, 0.361, 0.965, None));    // #8b5cf6
    let pink = Color::Rgb(Rgb::new(0.925, 0.282, 0.600, None));      // #ec4899
    let black = Color::Rgb(Rgb::new(0.122, 0.161, 0.216, None));     // #1f2937
    let gray = Color::Rgb(Rgb::new(0.42, 0.44, 0.50, None));
    let light_gray = Color::Rgb(Rgb::new(0.90, 0.91, 0.93, None));
    let _white = Color::Rgb(Rgb::new(1.0, 1.0, 1.0, None));

    let mut y: f32 = 278.0;

    // Business name in purple (left)
    layer.set_fill_color(purple.clone());
    layer.use_text(&settings.business_name, 18.0, Mm(20.0), Mm(y), font_bold);

    // Logo
    if let Some(ref logo_path) = settings.logo_path {
        add_logo(layer, logo_path, 155.0, y - 14.0, 20.0);
    }

    // Business details
    layer.set_fill_color(gray.clone());
    y -= 6.0;
    let mut info_parts = Vec::new();
    if let Some(ref phone) = settings.business_phone { info_parts.push(phone.clone()); }
    if let Some(ref email) = settings.business_email { info_parts.push(email.clone()); }
    if !info_parts.is_empty() {
        layer.use_text(&info_parts.join(" • "), 8.0, Mm(20.0), Mm(y), font);
    }

    // Separator
    y -= 5.0;
    layer.set_outline_color(light_gray.clone());
    let sep = Line {
        points: vec![
            (Point::new(Mm(20.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(sep);

    // Invoice number on right
    layer.set_fill_color(gray.clone());
    layer.use_text("INVOICE", 7.0, Mm(160.0), Mm(y + 16.0), font);
    layer.set_fill_color(purple.clone());
    layer.use_text(&format!("#{}", invoice.invoice_number.as_deref().unwrap_or("-")), 20.0, Mm(148.0), Mm(y + 8.0), font_bold);

    y -= 8.0;

    // Bill To (left) + Dates (right)
    layer.set_fill_color(gray.clone());
    layer.use_text("BILL TO", 7.0, Mm(20.0), Mm(y), font_bold);
    layer.set_fill_color(black.clone());
    layer.use_text(invoice.customer_name.as_deref().unwrap_or("—"), 11.0, Mm(20.0), Mm(y - 5.0), font_bold);
    if let Some(ref phone) = invoice.customer_phone {
        layer.set_fill_color(gray.clone());
        layer.use_text(&format!("Tel: {}", phone), 8.0, Mm(20.0), Mm(y - 10.0), font);
    }

    // Dates grid on right
    layer.set_fill_color(gray.clone());
    layer.use_text("ISSUE DATE", 7.0, Mm(120.0), Mm(y), font_bold);
    layer.use_text("DUE DATE", 7.0, Mm(160.0), Mm(y), font_bold);
    layer.set_fill_color(black.clone());
    layer.use_text(&invoice.issue_date, 10.0, Mm(120.0), Mm(y - 5.0), font_bold);
    layer.set_fill_color(pink.clone());
    layer.use_text(&invoice.due_date, 10.0, Mm(160.0), Mm(y - 5.0), font_bold);

    y -= 20.0;

    // Table header (bordered top and bottom)
    layer.set_outline_color(light_gray.clone());
    let th_top = Line {
        points: vec![
            (Point::new(Mm(20.0), Mm(y + 4.0)), false),
            (Point::new(Mm(190.0), Mm(y + 4.0)), false),
        ],
        is_closed: false,
    };
    layer.add_line(th_top);

    layer.set_fill_color(gray.clone());
    layer.use_text("No", 7.0, Mm(20.0), Mm(y), font_bold);
    layer.use_text("ITEM", 7.0, Mm(30.0), Mm(y), font_bold);
    layer.use_text("QTY", 7.0, Mm(98.0), Mm(y), font_bold);
    layer.use_text("RATE", 7.0, Mm(115.0), Mm(y), font_bold);
    layer.use_text("TAX", 7.0, Mm(140.0), Mm(y), font_bold);
    let th = "AMOUNT";
    layer.use_text(th, 7.0, Mm(right_x(th, 7.0, 190.0)), Mm(y), font_bold);

    y -= 3.0;
    let th_bot = Line {
        points: vec![
            (Point::new(Mm(20.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(th_bot);
    y -= 5.0;

    // Items
    layer.set_fill_color(black.clone());
    if let Some(ref items) = invoice.items {
        for (i, item) in items.iter().enumerate() {
            if y < MIN_CONTENT_Y { break; }
            // Alternate row background
            if i % 2 == 0 {
                draw_rect(layer, 20.0, y - 2.0, 170.0, 7.0, Color::Rgb(Rgb::new(0.98, 0.98, 0.99, None)));
            }
            layer.set_fill_color(black.clone());
            layer.use_text(&format!("{}", i + 1), 9.0, Mm(20.0), Mm(y), font);
            let name = truncate_text(&item.product_name, 9.0, 58.0);
            layer.use_text(&name, 9.0, Mm(30.0), Mm(y), font);
            layer.use_text(&item.quantity.to_string(), 9.0, Mm(98.0), Mm(y), font);
            let up = format!("{}{:.2}", currency, item.unit_price);
            layer.use_text(&up, 9.0, Mm(115.0), Mm(y), font);
            layer.use_text(&format!("{:.0}%", item.tax_percent), 9.0, Mm(140.0), Mm(y), font);
            let lt = format!("{}{:.2}", currency, item.line_total);
            layer.use_text(&lt, 9.0, Mm(right_x(&lt, 9.0, 190.0)), Mm(y), font_bold);

            // Description sub-line
            if let Some(ref desc) = item.description {
                if !desc.is_empty() {
                    y -= 4.0;
                    layer.set_fill_color(gray.clone());
                    let desc_text = truncate_text(desc, 7.0, 60.0);
                    layer.use_text(&desc_text, 7.0, Mm(30.0), Mm(y), font);
                    layer.set_fill_color(black.clone());
                }
            }
            y -= 7.0;
        }
    }

    // Totals (right-aligned, minimal)
    y -= 6.0;
    layer.set_fill_color(gray.clone());
    layer.use_text("Subtotal", 9.0, Mm(130.0), Mm(y), font);
    layer.set_fill_color(black.clone());
    let v = format!("{}{:.2}", currency, invoice.subtotal);
    layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 190.0)), Mm(y), font);
    y -= 5.0;

    layer.set_fill_color(gray.clone());
    layer.use_text(&settings.tax_label, 9.0, Mm(130.0), Mm(y), font);
    layer.set_fill_color(black.clone());
    let v = format!("{}{:.2}", currency, invoice.tax);
    layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 190.0)), Mm(y), font);
    y -= 5.0;

    if invoice.advance > 0.0 {
        layer.set_fill_color(gray.clone());
        layer.use_text("Advance", 9.0, Mm(130.0), Mm(y), font);
        layer.set_fill_color(black.clone());
        let v = format!("-{}{:.2}", currency, invoice.advance);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 190.0)), Mm(y), font);
        y -= 5.0;
    }
    if invoice.discount_percent > 0.0 {
        let da = (invoice.subtotal + invoice.tax) * invoice.discount_percent / 100.0;
        layer.set_fill_color(gray.clone());
        layer.use_text(&format!("Discount ({:.0}%)", invoice.discount_percent), 9.0, Mm(130.0), Mm(y), font);
        layer.set_fill_color(black.clone());
        let v = format!("-{}{:.2}", currency, da);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 190.0)), Mm(y), font);
        y -= 5.0;
    } else if invoice.discount > 0.0 {
        layer.set_fill_color(gray.clone());
        layer.use_text("Discount", 9.0, Mm(130.0), Mm(y), font);
        layer.set_fill_color(black.clone());
        let v = format!("-{}{:.2}", currency, invoice.discount);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 190.0)), Mm(y), font);
        y -= 5.0;
    }

    // Separator
    y -= 1.0;
    layer.set_outline_color(light_gray.clone());
    let tot_sep = Line {
        points: vec![
            (Point::new(Mm(125.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(tot_sep);
    y -= 5.0;

    layer.set_fill_color(purple.clone());
    layer.use_text("TOTAL", 12.0, Mm(130.0), Mm(y), font_bold);
    let v = format!("{}{:.2}", currency, invoice.total);
    layer.use_text(&v, 12.0, Mm(right_x(&v, 12.0, 190.0)), Mm(y), font_bold);

    y -= 15.0;

    render_bottom_section(layer, font, font_bold, font_italic, invoice, settings, y, Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));
}

// ══════════════════════════════════════════════════════════
//  ClearStyle TEMPLATE (Classic invoice with signature & bank)
// ══════════════════════════════════════════════════════════
fn render_ClearStyle_pdf(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    font_bold: &printpdf::IndirectFontRef,
    font_italic: &printpdf::IndirectFontRef,
    invoice: &Invoice,
    settings: &Settings,
    currency: &str,
) {
    let black = Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None));
    let dark = Color::Rgb(Rgb::new(0.13, 0.13, 0.13, None));
    let gray = Color::Rgb(Rgb::new(0.4, 0.4, 0.4, None));
    let light_bg = Color::Rgb(Rgb::new(0.96, 0.96, 0.96, None));
    let white = Color::Rgb(Rgb::new(1.0, 1.0, 1.0, None));

    let mut y: f32 = 278.0;

    // ── Header: Logo (top-left) + Invoice No/Date (top-right) ──
    if let Some(ref logo_path) = settings.logo_path {
        add_logo(layer, logo_path, 20.0, y - 16.0, 22.0);
    }

    layer.set_fill_color(black.clone());
    layer.use_text("Invoice No:", 9.0, Mm(148.0), Mm(y), font_bold);
    layer.use_text(invoice.invoice_number.as_deref().unwrap_or("-"), 9.0, Mm(172.0), Mm(y), font);
    y -= 5.0;
    layer.use_text("Date:", 9.0, Mm(148.0), Mm(y), font_bold);
    layer.use_text(&invoice.issue_date, 9.0, Mm(172.0), Mm(y), font);

    // ── Business Name & Tagline (centered) ──
    y -= 8.0;
    // Center the business name
    let biz_name = &settings.business_name;
    let name_width_approx = text_width_mm(biz_name, 22.0);
    let name_x = (210.0 - name_width_approx) / 2.0;
    layer.set_fill_color(dark.clone());
    layer.use_text(biz_name, 22.0, Mm(name_x.max(20.0)), Mm(y), font_bold);

    if let Some(ref tagline) = settings.business_tagline {
        y -= 6.0;
        let tag_width = text_width_mm(tagline, 8.0);
        let tag_x = (210.0 - tag_width) / 2.0;
        layer.set_fill_color(gray.clone());
        layer.use_text(tagline, 8.0, Mm(tag_x.max(20.0)), Mm(y), font_italic);
    }

    // ── Separator ──
    y -= 4.0;
    layer.set_outline_color(dark.clone());
    let sep = Line {
        points: vec![
            (Point::new(Mm(20.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(sep);
    layer.set_outline_color(dark.clone());
    let sep2 = Line {
        points: vec![
            (Point::new(Mm(20.0), Mm(y - 0.6)), false),
            (Point::new(Mm(190.0), Mm(y - 0.6)), false),
        ],
        is_closed: false,
    };
    layer.add_line(sep2);

    // ── Business contact info (below line) ──
    y -= 5.0;
    layer.set_fill_color(gray.clone());
    if let Some(ref addr) = settings.business_address {
        layer.use_text(addr, 8.0, Mm(20.0), Mm(y), font);
        y -= 4.0;
    }
    if let Some(ref phone) = settings.business_phone {
        layer.use_text(&format!("Phone: {}", phone), 8.0, Mm(20.0), Mm(y), font);
        y -= 4.0;
    }
    if let Some(ref email) = settings.business_email {
        layer.use_text(&format!("Email: {}", email), 8.0, Mm(20.0), Mm(y), font);
        y -= 4.0;
    }

    // ── Dates & Status (right side) ──
    let dates_y = y + 12.0;
    layer.set_fill_color(black.clone());
    layer.use_text("Issue Date:", 8.0, Mm(140.0), Mm(dates_y), font_bold);
    layer.use_text(&invoice.issue_date, 8.0, Mm(165.0), Mm(dates_y), font);
    layer.use_text("Due Date:", 8.0, Mm(140.0), Mm(dates_y - 4.0), font_bold);
    layer.use_text(&invoice.due_date, 8.0, Mm(165.0), Mm(dates_y - 4.0), font);
    layer.use_text("Status:", 8.0, Mm(140.0), Mm(dates_y - 8.0), font_bold);
    layer.use_text(&invoice.status, 8.0, Mm(165.0), Mm(dates_y - 8.0), font);

    // ── Bill To ──
    y -= 5.0;
    layer.set_fill_color(dark.clone());
    layer.use_text("Bill To:", 10.0, Mm(20.0), Mm(y), font_bold);
    y -= 5.0;
    layer.set_fill_color(black.clone());
    layer.use_text(invoice.customer_name.as_deref().unwrap_or("—"), 10.0, Mm(20.0), Mm(y), font);
    if let Some(ref phone) = invoice.customer_phone {
        y -= 4.5;
        layer.use_text(&format!("Contact No: {}", phone), 9.0, Mm(20.0), Mm(y), font);
    }

    y -= 10.0;

    // ── Items Table with No column ──
    // Header bar
    draw_rect(layer, 20.0, y - 2.0, 170.0, 8.0, dark.clone());
    layer.set_fill_color(white.clone());
    layer.use_text("No", 8.0, Mm(23.0), Mm(y), font_bold);
    layer.use_text("Item", 8.0, Mm(35.0), Mm(y), font_bold);
    layer.use_text("Qty", 8.0, Mm(100.0), Mm(y), font_bold);
    layer.use_text("Unit Price", 8.0, Mm(115.0), Mm(y), font_bold);
    layer.use_text("Tax %", 8.0, Mm(145.0), Mm(y), font_bold);
    let th = "Total";
    layer.use_text(th, 8.0, Mm(right_x(th, 8.0, 188.0)), Mm(y), font_bold);

    y -= 8.0;
    layer.set_fill_color(black.clone());

    if let Some(ref items) = invoice.items {
        for (i, item) in items.iter().enumerate() {
            if y < MIN_CONTENT_Y { break; }
            // Alternate row
            if i % 2 == 0 {
                draw_rect(layer, 20.0, y - 2.0, 170.0, 7.0, light_bg.clone());
            }
            layer.set_fill_color(black.clone());
            layer.use_text(&format!("{}", i + 1), 9.0, Mm(23.0), Mm(y), font);
            let name = truncate_text(&item.product_name, 9.0, 55.0);
            layer.use_text(&name, 9.0, Mm(35.0), Mm(y), font);
            layer.use_text(&item.quantity.to_string(), 9.0, Mm(100.0), Mm(y), font);
            let up = format!("{}{:.2}", currency, item.unit_price);
            layer.use_text(&up, 9.0, Mm(115.0), Mm(y), font);
            layer.use_text(&format!("{:.1}%", item.tax_percent), 9.0, Mm(145.0), Mm(y), font);
            let lt = format!("{}{:.2}", currency, item.line_total);
            layer.use_text(&lt, 9.0, Mm(right_x(&lt, 9.0, 188.0)), Mm(y), font);

            // Description sub-line
            if let Some(ref desc) = item.description {
                if !desc.is_empty() {
                    y -= 4.0;
                    layer.set_fill_color(gray.clone());
                    let desc_text = truncate_text(desc, 7.0, 55.0);
                    layer.use_text(&desc_text, 7.0, Mm(35.0), Mm(y), font);
                    layer.set_fill_color(black.clone());
                }
            }

            y -= 7.0;
        }
    }

    // ── Totals ──
    y -= 2.0;
    // Separator line above totals
    layer.set_outline_color(dark.clone());
    let tot_line = Line {
        points: vec![
            (Point::new(Mm(120.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(tot_line);
    y -= 5.0;

    layer.set_fill_color(black.clone());
    layer.use_text("Subtotal:", 9.0, Mm(130.0), Mm(y), font);
    let v = format!("{}{:.2}", currency, invoice.subtotal);
    layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), font);
    y -= 5.0;

    layer.use_text(&format!("{}:", &settings.tax_label), 9.0, Mm(130.0), Mm(y), font);
    let v = format!("{}{:.2}", currency, invoice.tax);
    layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), font);
    y -= 5.0;

    if invoice.advance > 0.0 {
        layer.use_text("Advance:", 9.0, Mm(130.0), Mm(y), font);
        let v = format!("-{}{:.2}", currency, invoice.advance);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), font);
        y -= 5.0;
    }
    if invoice.discount_percent > 0.0 {
        let da = (invoice.subtotal + invoice.tax) * invoice.discount_percent / 100.0;
        layer.use_text(&format!("Discount ({:.0}%):", invoice.discount_percent), 9.0, Mm(130.0), Mm(y), font);
        let v = format!("-{}{:.2}", currency, da);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), font);
        y -= 5.0;
    } else if invoice.discount > 0.0 {
        layer.use_text("Discount:", 9.0, Mm(130.0), Mm(y), font);
        let v = format!("-{}{:.2}", currency, invoice.discount);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), font);
        y -= 5.0;
    }

    // TOTAL line
    y -= 1.0;
    layer.set_outline_color(dark.clone());
    let tot_sep = Line {
        points: vec![
            (Point::new(Mm(120.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(tot_sep);
    y -= 5.0;
    layer.set_fill_color(dark.clone());
    layer.use_text("TOTAL:", 11.0, Mm(125.0), Mm(y), font_bold);
    let v = format!("{}{:.2}", currency, invoice.total);
    layer.use_text(&v, 11.0, Mm(right_x(&v, 11.0, 188.0)), Mm(y), font_bold);

    y -= 12.0;

    // ── Bank Details (left) ──
    layer.set_fill_color(black.clone());
    if settings.bank_name.is_some() || settings.bank_account_no.is_some() {
        layer.use_text("Bank Details:", 10.0, Mm(20.0), Mm(y), font_bold);
        y -= 5.0;
        if let Some(ref bank) = settings.bank_name {
            layer.use_text(&format!("Bank: {}", bank), 9.0, Mm(20.0), Mm(y), font);
            y -= 4.5;
        }
        if let Some(ref acct_name) = settings.bank_account_name {
            layer.use_text(&format!("Account Name: {}", acct_name), 9.0, Mm(20.0), Mm(y), font);
            y -= 4.5;
        }
        if let Some(ref acct_no) = settings.bank_account_no {
            layer.use_text(&format!("Account No: {}", acct_no), 9.0, Mm(20.0), Mm(y), font);
            y -= 4.5;
        }
        if let Some(ref branch) = settings.bank_branch {
            layer.use_text(&format!("Branch: {}", branch), 9.0, Mm(20.0), Mm(y), font);
            y -= 4.5;
        }
        y -= 3.0;
    }

    // ── Notes ──
    if let Some(ref notes) = invoice.notes {
        if !notes.is_empty() {
            layer.set_fill_color(black.clone());
            layer.use_text("Notes:", 10.0, Mm(20.0), Mm(y), font_bold);
            y -= 5.0;
            layer.set_fill_color(gray.clone());
            layer.use_text(notes, 8.0, Mm(20.0), Mm(y), font_italic);
            y -= 8.0;
        }
    }

    // ── Signature (right side) ──
    let sig_y = y + 5.0;
    if let Some(ref sig_path) = settings.signature_path {
        add_image(layer, sig_path, 150.0, sig_y, 15.0);
        layer.set_fill_color(gray.clone());
        layer.use_text("Authorised Sign", 8.0, Mm(153.0), Mm(sig_y - 4.0), font_italic);
    } else {
        // Draw signature line even without image
        layer.set_outline_color(gray.clone());
        let sig_line = Line {
            points: vec![
                (Point::new(Mm(145.0), Mm(sig_y)), false),
                (Point::new(Mm(190.0), Mm(sig_y)), false),
            ],
            is_closed: false,
        };
        layer.add_line(sig_line);
        layer.set_fill_color(gray.clone());
        layer.use_text("Authorised Sign", 8.0, Mm(153.0), Mm(sig_y - 4.0), font_italic);
    }

    // ── Footer ──
    // QR Code bottom-left
    if let Some(ref qr_path) = settings.qr_code_path {
        add_image(layer, qr_path, 20.0, 10.0, 18.0);
    }

    // Footer text
    let footer_text = settings.default_footer.as_deref().unwrap_or("Thank you for your business!");
    layer.set_fill_color(gray.clone());
    layer.use_text(footer_text, 8.0, Mm(60.0), Mm(15.0), font);

    // Business contact in footer-right
    let mut fy = 20.0;
    if let Some(ref phone) = settings.business_phone {
        layer.use_text(phone, 7.0, Mm(155.0), Mm(fy), font);
        fy -= 3.5;
    }
    if let Some(ref email) = settings.business_email {
        layer.use_text(email, 7.0, Mm(155.0), Mm(fy), font);
    }
}

// ══════════════════════════════════════════════════════════
//  SHARED HELPERS
// ══════════════════════════════════════════════════════════

/// Render items table (used by Basic template)
fn render_items_table(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    font_bold: &printpdf::IndirectFontRef,
    invoice: &Invoice,
    _settings: &Settings,
    currency: &str,
    mut y: f32,
    accent: Color,
    black: Color,
) -> f32 {
    let light_bg = Color::Rgb(Rgb::new(0.96, 0.96, 0.96, None));
    let white = Color::Rgb(Rgb::new(1.0, 1.0, 1.0, None));
    let gray = Color::Rgb(Rgb::new(0.4, 0.4, 0.4, None));

    // Table header bar
    draw_rect(layer, 20.0, y - 2.0, 170.0, 8.0, accent.clone());
    layer.set_fill_color(white.clone());
    layer.use_text("No", 8.0, Mm(23.0), Mm(y), font_bold);
    layer.use_text("Item", 8.0, Mm(33.0), Mm(y), font_bold);
    layer.use_text("Qty", 8.0, Mm(98.0), Mm(y), font_bold);
    layer.use_text("Unit Price", 8.0, Mm(112.0), Mm(y), font_bold);
    layer.use_text("Tax %", 8.0, Mm(142.0), Mm(y), font_bold);
    let th = "Total";
    layer.use_text(th, 8.0, Mm(right_x(th, 8.0, 188.0)), Mm(y), font_bold);

    y -= 8.0;

    layer.set_fill_color(black.clone());
    if let Some(ref items) = invoice.items {
        for (i, item) in items.iter().enumerate() {
            if y < MIN_CONTENT_Y { break; }
            // Alternate row background
            if i % 2 == 0 {
                draw_rect(layer, 20.0, y - 2.0, 170.0, 7.0, light_bg.clone());
            }
            layer.set_fill_color(black.clone());
            layer.use_text(&format!("{}", i + 1), 9.0, Mm(23.0), Mm(y), font);
            let name = truncate_text(&item.product_name, 9.0, 55.0);
            layer.use_text(&name, 9.0, Mm(33.0), Mm(y), font);
            layer.use_text(&item.quantity.to_string(), 9.0, Mm(98.0), Mm(y), font);
            let up = format!("{}{:.2}", currency, item.unit_price);
            layer.use_text(&up, 9.0, Mm(112.0), Mm(y), font);
            layer.use_text(&format!("{:.1}%", item.tax_percent), 9.0, Mm(142.0), Mm(y), font);
            let lt = format!("{}{:.2}", currency, item.line_total);
            layer.use_text(&lt, 9.0, Mm(right_x(&lt, 9.0, 188.0)), Mm(y), font);

            // Description sub-line
            if let Some(ref desc) = item.description {
                if !desc.is_empty() {
                    y -= 4.0;
                    layer.set_fill_color(gray.clone());
                    let desc_text = truncate_text(desc, 7.0, 60.0);
                    layer.use_text(&desc_text, 7.0, Mm(33.0), Mm(y), font);
                    layer.set_fill_color(black.clone());
                }
            }
            y -= 7.0;
        }
    }

    // Bottom border line
    layer.set_outline_color(accent.clone());
    let bot_line = Line {
        points: vec![
            (Point::new(Mm(20.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(bot_line);
    layer.set_outline_color(black.clone());

    y
}

/// Render totals section (used by Basic template)
fn render_totals(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    font_bold: &printpdf::IndirectFontRef,
    invoice: &Invoice,
    settings: &Settings,
    currency: &str,
    mut y: f32,
    accent: Color,
    black: Color,
) -> f32 {
    y -= 2.0;
    layer.set_outline_color(accent.clone());
    let sep = Line {
        points: vec![
            (Point::new(Mm(120.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(sep);
    layer.set_outline_color(black.clone());
    y -= 5.0;

    layer.set_fill_color(black.clone());
    layer.use_text("Subtotal:", 9.0, Mm(130.0), Mm(y), font);
    let v = format!("{}{:.2}", currency, invoice.subtotal);
    layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 190.0)), Mm(y), font);
    y -= 5.0;

    layer.use_text(&format!("{}:", &settings.tax_label), 9.0, Mm(130.0), Mm(y), font);
    let v = format!("{}{:.2}", currency, invoice.tax);
    layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 190.0)), Mm(y), font);
    y -= 5.0;

    if invoice.advance > 0.0 {
        layer.use_text("Advance:", 9.0, Mm(130.0), Mm(y), font);
        let v = format!("-{}{:.2}", currency, invoice.advance);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 190.0)), Mm(y), font);
        y -= 5.0;
    }
    if invoice.discount_percent > 0.0 {
        let da = (invoice.subtotal + invoice.tax) * invoice.discount_percent / 100.0;
        layer.use_text(&format!("Discount ({:.0}%):", invoice.discount_percent), 9.0, Mm(130.0), Mm(y), font);
        let v = format!("-{}{:.2}", currency, da);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 190.0)), Mm(y), font);
        y -= 5.0;
    } else if invoice.discount > 0.0 {
        layer.use_text("Discount:", 9.0, Mm(130.0), Mm(y), font);
        let v = format!("-{}{:.2}", currency, invoice.discount);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 190.0)), Mm(y), font);
        y -= 5.0;
    }

    layer.set_fill_color(accent.clone());
    layer.use_text("TOTAL:", 12.0, Mm(130.0), Mm(y), font_bold);
    let v = format!("{}{:.2}", currency, invoice.total);
    layer.use_text(&v, 12.0, Mm(right_x(&v, 12.0, 190.0)), Mm(y), font_bold);
    layer.set_fill_color(black);

    y -= 10.0;
    y
}

/// Render bank details, notes, signature, QR code, footer (shared by Basic/Professional/Modern)
fn render_bottom_section(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    font_bold: &printpdf::IndirectFontRef,
    font_italic: &printpdf::IndirectFontRef,
    invoice: &Invoice,
    settings: &Settings,
    mut y: f32,
    text_color: Color,
) {
    let gray = Color::Rgb(Rgb::new(0.4, 0.4, 0.4, None));

    // Bank Details
    layer.set_fill_color(text_color.clone());
    if settings.bank_name.is_some() || settings.bank_account_no.is_some() {
        layer.use_text("Bank Details:", 10.0, Mm(20.0), Mm(y), font_bold);
        y -= 5.0;
        layer.set_fill_color(gray.clone());
        if let Some(ref bank) = settings.bank_name {
            layer.use_text(&format!("Bank: {}", bank), 9.0, Mm(20.0), Mm(y), font);
            y -= 4.5;
        }
        if let Some(ref acct_name) = settings.bank_account_name {
            layer.use_text(&format!("Account Name: {}", acct_name), 9.0, Mm(20.0), Mm(y), font);
            y -= 4.5;
        }
        if let Some(ref acct_no) = settings.bank_account_no {
            layer.use_text(&format!("Account No: {}", acct_no), 9.0, Mm(20.0), Mm(y), font);
            y -= 4.5;
        }
        if let Some(ref branch) = settings.bank_branch {
            layer.use_text(&format!("Branch: {}", branch), 9.0, Mm(20.0), Mm(y), font);
            y -= 4.5;
        }
        y -= 4.0;
    }

    // Notes
    if let Some(ref notes) = invoice.notes {
        if !notes.is_empty() {
            layer.set_fill_color(text_color.clone());
            layer.use_text("Notes:", 10.0, Mm(20.0), Mm(y), font_bold);
            y -= 5.0;
            layer.set_fill_color(gray.clone());
            layer.use_text(notes, 8.0, Mm(20.0), Mm(y), font_italic);
            y -= 8.0;
        }
    }

    // Signature (right side)
    if let Some(ref sig_path) = settings.signature_path {
        add_image(layer, sig_path, 150.0, y + 5.0, 15.0);
        layer.set_fill_color(gray.clone());
        layer.use_text("Authorised Sign", 8.0, Mm(153.0), Mm(y), font_italic);
    } else {
        layer.set_outline_color(gray.clone());
        let sig_line = Line {
            points: vec![
                (Point::new(Mm(145.0), Mm(y + 3.0)), false),
                (Point::new(Mm(190.0), Mm(y + 3.0)), false),
            ],
            is_closed: false,
        };
        layer.add_line(sig_line);
        layer.set_fill_color(gray.clone());
        layer.use_text("Authorised Sign", 8.0, Mm(153.0), Mm(y - 1.0), font_italic);
    }

    // QR Code (bottom-left)
    if let Some(ref qr_path) = settings.qr_code_path {
        add_image(layer, qr_path, 20.0, 10.0, 18.0);
    }

    // Footer
    let footer_text = settings.default_footer.as_deref().unwrap_or("Thank you for your business!");
    layer.set_fill_color(gray);
    layer.use_text(footer_text, 8.0, Mm(60.0), Mm(15.0), font);
}

// ══════════════════════════════════════════════════════════
//  PAYSLIP PDF GENERATION
// ══════════════════════════════════════════════════════════

pub fn generate_payslip_pdf(
    payroll: &crate::models::PayrollRecord,
    settings: &crate::models::Settings,
    file_path: &str,
) -> Result<String, String> {
    let (doc, page1, layer1) = PdfDocument::new(
        &format!("Payslip {}", payroll.employee_name.as_deref().unwrap_or("")),
        Mm(210.0),
        Mm(297.0),
        "Layer 1",
    );

    let layer = doc.get_page(page1).get_layer(layer1);
    let font = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| e.to_string())?;
    let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold).map_err(|e| e.to_string())?;

    let currency = &settings.currency_symbol;
    let black = Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None));
    let light_bg = Color::Rgb(Rgb::new(0.94, 0.94, 0.94, None));

    let mut y: f32 = 280.0;

    // ── Header ──
    layer.set_fill_color(black.clone());
    layer.use_text(&settings.business_name, 16.0, Mm(20.0), Mm(y), &font_bold);
    y -= 10.0;
    layer.use_text("PAYSLIP", 12.0, Mm(20.0), Mm(y), &font_bold);

    // Pay period on right
    layer.use_text("Pay Period", 8.0, Mm(140.0), Mm(280.0), &font);
    layer.use_text(
        &format!("{} - {}", &payroll.pay_period_start, &payroll.pay_period_end),
        9.0, Mm(140.0), Mm(274.0), &font_bold
    );

    y -= 4.0;
    layer.set_outline_color(black.clone());
    let sep = Line {
        points: vec![
            (Point::new(Mm(20.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(sep);
    y -= 8.0;

    // ── Employee Details ──
    layer.set_fill_color(black.clone());
    layer.use_text("EMPLOYEE NAME", 7.0, Mm(20.0), Mm(y), &font_bold);
    layer.use_text("POSITION", 7.0, Mm(110.0), Mm(y), &font_bold);
    y -= 5.0;
    layer.use_text(payroll.employee_name.as_deref().unwrap_or("—"), 10.0, Mm(20.0), Mm(y), &font_bold);
    layer.use_text(payroll.employee_role.as_deref().unwrap_or("—"), 10.0, Mm(110.0), Mm(y), &font_bold);
    y -= 8.0;

    layer.use_text("PAYMENT DATE", 7.0, Mm(20.0), Mm(y), &font_bold);
    layer.use_text("STATUS", 7.0, Mm(110.0), Mm(y), &font_bold);
    y -= 5.0;
    layer.use_text(&payroll.payment_date, 10.0, Mm(20.0), Mm(y), &font);
    layer.use_text(&payroll.status, 10.0, Mm(110.0), Mm(y), &font);
    y -= 12.0;

    // ── Earnings Table Header ──
    draw_rect(&layer, 20.0, y - 2.0, 170.0, 8.0, black.clone());
    layer.set_fill_color(Color::Rgb(Rgb::new(1.0, 1.0, 1.0, None)));
    layer.use_text("Description", 8.0, Mm(25.0), Mm(y), &font_bold);
    let th = "Amount";
    layer.use_text(th, 8.0, Mm(right_x(th, 8.0, 188.0)), Mm(y), &font_bold);
    y -= 10.0;

    // ── Earnings rows ──
    layer.set_fill_color(black.clone());

    // Base Salary
    draw_rect(&layer, 20.0, y - 2.0, 170.0, 7.0, light_bg.clone());
    layer.set_fill_color(black.clone());
    layer.use_text("Base Salary", 9.0, Mm(25.0), Mm(y), &font);
    let v = format!("{}{:.2}", currency, payroll.base_salary);
    layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), &font);
    y -= 7.0;

    // Overtime Pay
    if payroll.overtime_pay > 0.0 {
        layer.set_fill_color(black.clone());
        layer.use_text("Overtime Pay", 9.0, Mm(25.0), Mm(y), &font);
        let v = format!("{}{:.2}", currency, payroll.overtime_pay);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), &font);
        y -= 7.0;
    }

    // Bonuses
    if payroll.bonuses > 0.0 {
        draw_rect(&layer, 20.0, y - 2.0, 170.0, 7.0, light_bg.clone());
        layer.set_fill_color(black.clone());
        layer.use_text("Bonuses", 9.0, Mm(25.0), Mm(y), &font);
        let v = format!("{}{:.2}", currency, payroll.bonuses);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), &font);
        y -= 7.0;
    }

    // Allowances
    if payroll.allowances > 0.0 {
        layer.set_fill_color(black.clone());
        layer.use_text("Allowances", 9.0, Mm(25.0), Mm(y), &font);
        let v = format!("{}{:.2}", currency, payroll.allowances);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), &font);
        y -= 7.0;
    }

    // Gross Salary
    y -= 2.0;
    layer.set_outline_color(black.clone());
    let sep = Line {
        points: vec![
            (Point::new(Mm(20.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(sep);
    y -= 6.0;
    layer.set_fill_color(black.clone());
    layer.use_text("Gross Salary", 9.0, Mm(25.0), Mm(y), &font_bold);
    let v = format!("{}{:.2}", currency, payroll.gross_salary);
    layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), &font_bold);
    y -= 12.0;

    // ── Deductions Table ──
    let has_deductions = payroll.tax > 0.0 || payroll.late_penalties > 0.0
        || payroll.absences > 0.0 || payroll.other_deductions > 0.0;

    if has_deductions {
        draw_rect(&layer, 20.0, y - 2.0, 170.0, 8.0, black.clone());
        layer.set_fill_color(Color::Rgb(Rgb::new(1.0, 1.0, 1.0, None)));
        layer.use_text("Deductions", 8.0, Mm(25.0), Mm(y), &font_bold);
        let th = "Amount";
        layer.use_text(th, 8.0, Mm(right_x(th, 8.0, 188.0)), Mm(y), &font_bold);
        y -= 10.0;

        layer.set_fill_color(black.clone());

        if payroll.tax > 0.0 {
            draw_rect(&layer, 20.0, y - 2.0, 170.0, 7.0, light_bg.clone());
            layer.set_fill_color(black.clone());
            layer.use_text("Tax", 9.0, Mm(25.0), Mm(y), &font);
            let v = format!("-{}{:.2}", currency, payroll.tax);
            layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), &font);
            y -= 7.0;
        }
        if payroll.late_penalties > 0.0 {
            layer.set_fill_color(black.clone());
            layer.use_text("Late Penalties", 9.0, Mm(25.0), Mm(y), &font);
            let v = format!("-{}{:.2}", currency, payroll.late_penalties);
            layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), &font);
            y -= 7.0;
        }
        if payroll.absences > 0.0 {
            draw_rect(&layer, 20.0, y - 2.0, 170.0, 7.0, light_bg.clone());
            layer.set_fill_color(black.clone());
            layer.use_text("Absences", 9.0, Mm(25.0), Mm(y), &font);
            let v = format!("-{}{:.2}", currency, payroll.absences);
            layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), &font);
            y -= 7.0;
        }
        if payroll.other_deductions > 0.0 {
            layer.set_fill_color(black.clone());
            layer.use_text("Other Deductions", 9.0, Mm(25.0), Mm(y), &font);
            let v = format!("-{}{:.2}", currency, payroll.other_deductions);
            layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), &font);
            y -= 7.0;
        }

        y -= 2.0;
        layer.set_outline_color(black.clone());
        let sep = Line {
            points: vec![
                (Point::new(Mm(20.0), Mm(y)), false),
                (Point::new(Mm(190.0), Mm(y)), false),
            ],
            is_closed: false,
        };
        layer.add_line(sep);
        y -= 6.0;
        layer.set_fill_color(black.clone());
        layer.use_text("Total Deductions", 9.0, Mm(25.0), Mm(y), &font_bold);
        let v = format!("-{}{:.2}", currency, payroll.total_deductions);
        layer.use_text(&v, 9.0, Mm(right_x(&v, 9.0, 188.0)), Mm(y), &font_bold);
        y -= 12.0;
    }

    // ── Net Pay ──
    y -= 2.0;
    layer.set_outline_color(black.clone());
    let thick_top = Line {
        points: vec![
            (Point::new(Mm(20.0), Mm(y + 6.0)), false),
            (Point::new(Mm(190.0), Mm(y + 6.0)), false),
        ],
        is_closed: false,
    };
    layer.add_line(thick_top);
    let thick_bot = Line {
        points: vec![
            (Point::new(Mm(20.0), Mm(y - 8.0)), false),
            (Point::new(Mm(190.0), Mm(y - 8.0)), false),
        ],
        is_closed: false,
    };
    layer.add_line(thick_bot);
    layer.set_fill_color(black.clone());
    layer.use_text("NET PAY", 12.0, Mm(25.0), Mm(y), &font_bold);
    let np = format!("{}{:.2}", currency, payroll.net_pay);
    layer.use_text(&np, 12.0, Mm(right_x(&np, 12.0, 188.0)), Mm(y), &font_bold);
    y -= 18.0;

    // ── Notes ──
    if let Some(ref notes) = payroll.notes {
        if !notes.is_empty() {
            layer.use_text("Notes:", 9.0, Mm(20.0), Mm(y), &font_bold);
            y -= 5.0;
            layer.use_text(notes, 8.0, Mm(20.0), Mm(y), &font);
            y -= 8.0;
        }
    }

    // ── Footer ──
    layer.use_text(&settings.business_name, 7.0, Mm(20.0), Mm(25.0), &font);

    // Save
    let file = File::create(file_path).map_err(|e| e.to_string())?;
    doc.save(&mut BufWriter::new(file)).map_err(|e| e.to_string())?;

    Ok(file_path.to_string())
}